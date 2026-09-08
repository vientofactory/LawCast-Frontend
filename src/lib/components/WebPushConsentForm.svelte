<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component, ComponentProps } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { dev } from '$app/environment';
	import { apiClient } from '$lib/api/client';
	import { executePowInWorker, type PowStatus } from '$lib/hashguard-worker';
	import { applyPowStatus, createPowDisplayState } from '$lib/utils/pow-status';
	import PoWChallengeStatus from './PoWChallengeStatus.svelte';
	import type FullUnsubscribeConfirmModal from './FullUnsubscribeConfirmModal.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBell,
		faBellSlash,
		faChevronDown,
		faSpinner,
		faTriangleExclamation,
		faCloud,
		faShieldHalved
	} from '@fortawesome/free-solid-svg-icons';

	export let onSuccess: (message: string) => void = () => {};
	export let onError: (message: string) => void = () => {};
	export let onClearMessage: () => void = () => {};
	export let threadId: number | undefined = undefined;
	export let showFullUnsubscribeControl = true;
	export let compact = false;
	export let showInlineFeedback = true;

	let isSupported = false;
	let isPermissionDenied = false;
	let isPushEnabledByServer = false;
	let vapidPublicKey: string | null = null;
	let isSubscribed = false;
	let isNoticeNotificationsEnabled = false;
	let isDiscussionBound = false;
	let isLoading = true;
	let isSubmitting = false;
	let swScope: string | null = null;
	let swActiveState: string | null = null;
	let subscriptionEndpointPreview: string | null = null;
	let lastDebugUpdatedAt: string | null = null;
	let isSolvingPoW = false;
	let isFullUnsubscribeOpen = false;
	let isFullUnsubscribeConfirmOpen = false;
	let feedback: { type: 'success' | 'error'; message: string } | null = null;
	let FullUnsubscribeConfirmModalComponent: Component<
		ComponentProps<typeof FullUnsubscribeConfirmModal>
	> | null = null;
	let powState = createPowDisplayState();

	function updatePowStatus(status: PowStatus) {
		powState = applyPowStatus(powState, status);
	}

	function clearFeedback() {
		feedback = null;
		onClearMessage();
	}

	function showFeedback(type: 'success' | 'error', message: string) {
		feedback = { type, message };
		if (type === 'success') onSuccess(message);
		else onError(message);
	}

	function urlBase64ToUint8Array(base64String: string): Uint8Array {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);

		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}

		return outputArray;
	}

	function extractSubscriptionPayload(subscription: PushSubscription): {
		endpoint: string;
		p256dh: string;
		auth: string;
	} {
		const json = subscription.toJSON();
		const keys = json.keys ?? {};

		if (!json.endpoint || !keys.p256dh || !keys.auth) {
			throw new Error('브라우저 푸시 구독 키를 읽지 못했습니다.');
		}

		return {
			endpoint: json.endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth
		};
	}

	async function detectCurrentSubscription(): Promise<PushSubscription | null> {
		const registration = await navigator.serviceWorker.register('/sw.js');
		return registration.pushManager.getSubscription();
	}

	function toEndpointPreview(endpoint: string): string {
		if (!endpoint) return '(empty)';
		if (endpoint.length <= 64) return endpoint;
		return `${endpoint.slice(0, 48)}...${endpoint.slice(-12)}`;
	}

	async function refreshDebugState(subscription: PushSubscription | null): Promise<void> {
		if (!dev || !isSupported) {
			return;
		}

		try {
			const registration = await navigator.serviceWorker.getRegistration('/sw.js');
			swScope = registration?.scope ?? null;
			swActiveState = registration?.active?.state ?? registration?.installing?.state ?? null;
			subscriptionEndpointPreview = subscription ? toEndpointPreview(subscription.endpoint) : null;
			lastDebugUpdatedAt = new Date().toISOString();
		} catch {
			swScope = null;
			swActiveState = null;
			subscriptionEndpointPreview = null;
			lastDebugUpdatedAt = new Date().toISOString();
		}
	}

	async function refreshState() {
		isLoading = true;
		try {
			const config = await apiClient.getWebPushPublicConfig();
			isPushEnabledByServer = config.enabled;
			vapidPublicKey = config.publicKey;

			if (!isSupported) {
				isSubscribed = false;
				return;
			}

			const subscription = await detectCurrentSubscription();
			isSubscribed = !!subscription;
			isNoticeNotificationsEnabled = false;
			isDiscussionBound = false;
			if (subscription) {
				const noticeStatus = await apiClient.getWebPushNoticeStatus(subscription.endpoint);
				isNoticeNotificationsEnabled = noticeStatus.enabled;
			}
			if (threadId !== undefined && subscription) {
				const status = await apiClient.getDiscussionWebPushStatus(threadId, subscription.endpoint);
				isDiscussionBound = status.isBound;
			}
			await refreshDebugState(subscription);
		} catch (error) {
			showFeedback(
				'error',
				error instanceof Error ? error.message : '웹 푸시 상태 확인에 실패했습니다.'
			);
		} finally {
			isLoading = false;
		}
	}

	async function enableWebPush() {
		if (isSubmitting || isSolvingPoW || !isSupported) return;

		clearFeedback();
		isSubmitting = true;
		let subscriptionCreatedInThisAttempt = false;
		let activeSubscription: PushSubscription | null = null;

		try {
			if (!isPushEnabledByServer || !vapidPublicKey) {
				throw new Error('서버 웹 푸시가 비활성화되어 있습니다. 관리자에게 문의해주세요.');
			}

			isSolvingPoW = true;
			powState = createPowDisplayState('보안 검증을 준비하고 있어요...');

			const proof = await executePowInWorker('webpush-subscription', updatePowStatus);
			isSolvingPoW = false;
			powState = createPowDisplayState();

			const permission = await Notification.requestPermission();
			isPermissionDenied = permission === 'denied';
			if (permission !== 'granted') {
				throw new Error('브라우저 알림 권한이 허용되지 않았습니다.');
			}

			const registration = await navigator.serviceWorker.register('/sw.js');
			let subscription = await registration.pushManager.getSubscription();
			activeSubscription = subscription;

			if (!subscription) {
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
				});
				subscriptionCreatedInThisAttempt = true;
				activeSubscription = subscription;
			}

			const payload = extractSubscriptionPayload(subscription);
			await apiClient.registerWebPushSubscription({
				...payload,
				proof,
				...(threadId === undefined ? {} : { threadId })
			});

			isSubscribed = true;
			if (threadId === undefined) {
				isNoticeNotificationsEnabled = true;
			}
			isDiscussionBound = threadId !== undefined;
			await refreshDebugState(subscription);
			showFeedback('success', '웹 푸시 알림이 활성화되었습니다.');
		} catch (error) {
			if (subscriptionCreatedInThisAttempt && activeSubscription) {
				try {
					await activeSubscription.unsubscribe();
				} catch {
					// Ignore rollback failure and proceed with error handling.
				}
			}

			const currentSubscription = await detectCurrentSubscription().catch(() => null);
			isSubscribed = !!currentSubscription;
			isNoticeNotificationsEnabled = false;
			isDiscussionBound = false;
			await refreshDebugState(currentSubscription);

			isSolvingPoW = false;
			powState = createPowDisplayState();
			showFeedback(
				'error',
				error instanceof Error ? error.message : '웹 푸시 활성화에 실패했습니다.'
			);
		} finally {
			isSubmitting = false;
			if (!isSolvingPoW) {
				powState = createPowDisplayState();
			}
		}
	}

	async function disableWebPush() {
		if (isSubmitting || !isSupported || !isNoticeNotificationsEnabled) return;

		clearFeedback();
		isSubmitting = true;

		try {
			const subscription = await detectCurrentSubscription();

			if (!subscription) throw new Error('브라우저 웹 푸시 구독을 찾지 못했습니다.');

			await apiClient.updateWebPushNoticePreference(subscription.endpoint, false);
			isNoticeNotificationsEnabled = false;
			showFeedback('success', '입법예고 알림이 해지되었습니다.');
		} catch (error) {
			showFeedback(
				'error',
				error instanceof Error ? error.message : '웹 푸시 해지에 실패했습니다.'
			);
		} finally {
			isSubmitting = false;
		}
	}

	async function disableDiscussionWebPush() {
		if (isSubmitting || !isSupported || threadId === undefined || !isDiscussionBound) {
			return;
		}

		clearFeedback();
		isSubmitting = true;

		try {
			const subscription = await detectCurrentSubscription();
			if (!subscription) throw new Error('브라우저 웹 푸시 구독을 찾지 못했습니다.');

			await apiClient.unregisterDiscussionWebPushBinding(threadId, subscription.endpoint);
			isDiscussionBound = false;
			showFeedback('success', '이 스레드 인용 알림이 해지되었습니다.');
		} catch (error) {
			showFeedback(
				'error',
				error instanceof Error ? error.message : '스레드 인용 알림 해지에 실패했습니다.'
			);
		} finally {
			isSubmitting = false;
		}
	}

	async function unsubscribeBrowserPush() {
		if (isSubmitting || !isSupported || !isSubscribed) return;

		clearFeedback();
		isSubmitting = true;

		try {
			const subscription = await detectCurrentSubscription();
			if (!subscription) throw new Error('브라우저 웹 푸시 구독을 찾지 못했습니다.');

			await subscription.unsubscribe();
			await apiClient.unregisterWebPushSubscription(subscription.endpoint);
			isSubscribed = false;
			isNoticeNotificationsEnabled = false;
			isDiscussionBound = false;
			await refreshDebugState(null);
			showFeedback('success', '모든 웹 푸시 구독이 해지되었습니다.');
		} catch (error) {
			showFeedback(
				'error',
				error instanceof Error ? error.message : '웹 푸시 구독 해지에 실패했습니다.'
			);
		} finally {
			isSubmitting = false;
		}
	}

	async function openFullUnsubscribeConfirm(): Promise<void> {
		if (!FullUnsubscribeConfirmModalComponent) {
			const mod = await import('$lib/components/FullUnsubscribeConfirmModal.svelte');
			FullUnsubscribeConfirmModalComponent = mod.default;
		}
		isFullUnsubscribeConfirmOpen = true;
	}

	async function confirmFullUnsubscribe(): Promise<void> {
		isFullUnsubscribeConfirmOpen = false;
		await unsubscribeBrowserPush();
	}

	onMount(async () => {
		isSupported =
			typeof window !== 'undefined' &&
			'serviceWorker' in navigator &&
			'PushManager' in window &&
			'Notification' in window;
		isPermissionDenied = isSupported && Notification.permission === 'denied';

		await refreshState();
	});
</script>

<div
	class={compact
		? 'space-y-4'
		: 'lc-panel-card mt-6 rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl'}
>
	{#if !compact}
		<h2 class="lc-text-primary mb-6 flex items-center text-xl font-bold tracking-tight">
			<div class="lc-icon-accent-primary mr-3 rounded-lg p-2">
				<FontAwesomeIcon icon={faCloud} class="lc-text-on-accent h-5 w-5" />
			</div>
			브라우저 웹 푸시 알림
		</h2>
		<ul class="lc-text-secondary mb-6 space-y-2 text-sm">
			<li class="flex items-start">
				<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
				브라우저 알림 권한을 허용하면 새 법률안 및 변경 감지를 즉시 받을 수 있습니다.
			</li>
			<li class="flex items-start">
				<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
				로그인 없이 현재 브라우저 단위로 구독됩니다.
			</li>
		</ul>
	{/if}

	{#if showInlineFeedback && feedback}
		<div
			class={`mb-4 rounded-lg border p-3 text-sm ${
				feedback.type === 'success'
					? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
					: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
			}`}
			role={feedback.type === 'error' ? 'alert' : 'status'}
		>
			{feedback.message}
		</div>
	{/if}

	{#if isLoading}
		<div class="lc-text-muted flex items-center justify-center gap-2 py-4 text-sm">
			<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
			설정 상태를 확인하는 중입니다...
		</div>
	{:else if !isSupported}
		<div
			class="lc-text-danger flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
			현재 브라우저는 웹 푸시를 지원하지 않습니다.
		</div>
	{:else if !isPushEnabledByServer}
		<div
			class="lc-text-danger flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
			서버에서 웹 푸시가 비활성화되어 있습니다.
		</div>
	{:else}
		{#if isPermissionDenied}
			<div class="lc-text-danger mb-4 rounded-xl border border-red-200 px-3 py-2 text-sm">
				브라우저 알림 권한이 차단되어 있습니다. 브라우저 설정에서 이 사이트 알림을 허용한 뒤 다시
				시도해주세요.
			</div>
		{/if}

		{#if threadId === undefined}
			<section class="rounded-xl border border-(--lc-border-soft) bg-(--lc-surface-inset) p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 class="lc-text-primary text-sm font-bold">입법예고 알림</h3>
						<p class="lc-text-muted mt-1 text-xs">
							새 법률안과 변경 사항을 이 브라우저로 알려드립니다.
						</p>
					</div>
					<span
						class={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
							isNoticeNotificationsEnabled
								? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
								: 'bg-(--lc-surface-primary) text-(--lc-text-muted)'
						}`}
					>
						{isNoticeNotificationsEnabled ? '켜짐' : '꺼짐'}
					</span>
				</div>
				<div class="mt-4 flex items-center justify-between gap-3">
					<span class="lc-text-muted text-xs">알림 수신</span>
					<button
						type="button"
						on:click={() => (isNoticeNotificationsEnabled ? disableWebPush() : enableWebPush())}
						disabled={isSubmitting || isSolvingPoW}
						class="lc-theme-switch inline-flex cursor-pointer items-center rounded-full transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
						role="switch"
						aria-checked={isNoticeNotificationsEnabled}
						aria-label={isNoticeNotificationsEnabled ? '입법예고 알림 끄기' : '입법예고 알림 켜기'}
						title={isNoticeNotificationsEnabled ? '입법예고 알림 끄기' : '입법예고 알림 켜기'}
					>
						<span
							class={`lc-theme-switch-track ${isNoticeNotificationsEnabled ? 'is-dark' : ''}`}
							aria-hidden="true"
						>
							<span
								class={`lc-theme-switch-thumb ${isNoticeNotificationsEnabled ? 'is-dark' : ''}`}
							>
								<FontAwesomeIcon icon={faBell} class="h-3 w-3" />
							</span>
						</span>
					</button>
				</div>
			</section>

			{#if showFullUnsubscribeControl && isSubscribed}
				<div class="mt-4 rounded-xl border border-(--lc-border-soft) px-4 py-3">
					<button
						type="button"
						class="lc-text-secondary flex w-full cursor-pointer items-center justify-between text-left text-xs font-semibold"
						aria-expanded={isFullUnsubscribeOpen}
						on:click={() => (isFullUnsubscribeOpen = !isFullUnsubscribeOpen)}
					>
						<span>고급 설정: 브라우저 구독 전체 해지</span>
						<FontAwesomeIcon
							icon={faChevronDown}
							class={`h-3 w-3 transition-transform duration-200 ${isFullUnsubscribeOpen ? 'rotate-180' : ''}`}
						/>
					</button>

					{#if isFullUnsubscribeOpen}
						<div transition:slide={{ duration: 180 }}>
							<p
								class="lc-text-muted mt-2 text-xs leading-relaxed"
								transition:fade={{ duration: 140 }}
							>
								입법예고 알림과 모든 토론 인용 알림을 이 브라우저에서 함께 해지합니다.
							</p>
							<button
								type="button"
								on:click={openFullUnsubscribeConfirm}
								disabled={isSubmitting || !isSubscribed}
								class="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
							>
								<FontAwesomeIcon icon={faBellSlash} class="mr-2 h-3.5 w-3.5" />
								모든 웹 푸시 구독 해지
							</button>
						</div>
					{/if}
				</div>
			{/if}
		{:else}
			<section class="rounded-xl border border-(--lc-border-soft) bg-(--lc-surface-inset) p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 class="lc-text-primary text-sm font-bold">이 스레드의 인용 알림</h3>
						<p class="lc-text-muted mt-1 text-xs">
							내 의견이 이 스레드에서 인용될 때만 알려드립니다.
						</p>
					</div>
					<span
						class={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
							isDiscussionBound
								? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
								: 'bg-(--lc-surface-primary) text-(--lc-text-muted)'
						}`}
					>
						{isDiscussionBound ? '이 스레드에서 켜짐' : '꺼짐'}
					</span>
				</div>
				<div class="mt-4 flex items-center justify-between gap-3">
					<span class="lc-text-muted text-xs">이 스레드에서 수신</span>
					<button
						type="button"
						on:click={() => (isDiscussionBound ? disableDiscussionWebPush() : enableWebPush())}
						disabled={isSubmitting || isSolvingPoW}
						class="lc-theme-switch inline-flex cursor-pointer items-center rounded-full transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
						role="switch"
						aria-checked={isDiscussionBound}
						aria-label={isDiscussionBound ? '이 스레드 인용 알림 끄기' : '이 스레드 인용 알림 켜기'}
						title={isDiscussionBound ? '이 스레드 인용 알림 끄기' : '이 스레드 인용 알림 켜기'}
					>
						<span
							class={`lc-theme-switch-track ${isDiscussionBound ? 'is-dark' : ''}`}
							aria-hidden="true"
						>
							<span class={`lc-theme-switch-thumb ${isDiscussionBound ? 'is-dark' : ''}`}>
								<FontAwesomeIcon icon={faBell} class="h-3 w-3" />
							</span>
						</span>
					</button>
				</div>
			</section>
		{/if}

		{#if isSolvingPoW}
			<PoWChallengeStatus
				message={powState.message}
				estimatedRemainingMs={powState.estimatedRemainingMs}
				hashRate={powState.hashRate}
				difficultyBits={powState.difficultyBits}
				messageSpacingClass="mt-3"
				metricsSpacingClass="mt-2"
			/>
		{/if}

		{#if dev}
			<div class="mt-4 rounded-xl border border-slate-300/70 bg-slate-50/70 p-3 text-xs">
				<p class="mb-2 font-semibold text-slate-700">Web Push Notification Debug</p>
				<dl class="grid grid-cols-1 gap-1 text-slate-700">
					<div>
						<dt class="inline font-medium">supported:</dt>
						<dd class="inline ml-1">{isSupported ? 'true' : 'false'}</dd>
					</div>
					<div>
						<dt class="inline font-medium">permission:</dt>
						<dd class="inline ml-1">{isSupported ? Notification.permission : 'n/a'}</dd>
					</div>
					<div>
						<dt class="inline font-medium">serverEnabled:</dt>
						<dd class="inline ml-1">{isPushEnabledByServer ? 'true' : 'false'}</dd>
					</div>
					<div>
						<dt class="inline font-medium">vapidLoaded:</dt>
						<dd class="inline ml-1">{vapidPublicKey ? 'true' : 'false'}</dd>
					</div>
					<div>
						<dt class="inline font-medium">swScope:</dt>
						<dd class="inline ml-1 break-all">{swScope ?? '(not registered)'}</dd>
					</div>
					<div>
						<dt class="inline font-medium">swState:</dt>
						<dd class="inline ml-1">{swActiveState ?? '(unknown)'}</dd>
					</div>
					<div>
						<dt class="inline font-medium">subscription:</dt>
						<dd class="inline ml-1 break-all">{subscriptionEndpointPreview ?? '(none)'}</dd>
					</div>
					<div>
						<dt class="inline font-medium">updatedAt:</dt>
						<dd class="inline ml-1">{lastDebugUpdatedAt ?? '(n/a)'}</dd>
					</div>
				</dl>
			</div>
		{/if}
	{/if}
</div>

{#if FullUnsubscribeConfirmModalComponent}
	<svelte:component
		this={FullUnsubscribeConfirmModalComponent}
		isOpen={isFullUnsubscribeConfirmOpen}
		{isSubmitting}
		{isSubscribed}
		onConfirm={confirmFullUnsubscribe}
		onClose={() => (isFullUnsubscribeConfirmOpen = false)}
	></svelte:component>
{/if}
