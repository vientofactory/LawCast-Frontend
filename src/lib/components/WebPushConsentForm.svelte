<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { apiClient } from '$lib/api/client';
	import { executePowInWorker, type PowStatus } from '$lib/hashguard-worker';
	import { applyPowStatus, createPowDisplayState } from '$lib/utils/pow-status';
	import PoWChallengeStatus from './PoWChallengeStatus.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBell,
		faBellSlash,
		faSpinner,
		faTriangleExclamation,
		faCloud,
		faShieldHalved
	} from '@fortawesome/free-solid-svg-icons';

	export let onSuccess: (message: string) => void = () => {};
	export let onError: (message: string) => void = () => {};
	export let onClearMessage: () => void = () => {};

	let isSupported = false;
	let isPermissionDenied = false;
	let isPushEnabledByServer = false;
	let vapidPublicKey: string | null = null;
	let isSubscribed = false;
	let isLoading = true;
	let isSubmitting = false;
	let swScope: string | null = null;
	let swActiveState: string | null = null;
	let subscriptionEndpointPreview: string | null = null;
	let lastDebugUpdatedAt: string | null = null;
	let isSolvingPoW = false;
	let powState = createPowDisplayState();

	function updatePowStatus(status: PowStatus) {
		powState = applyPowStatus(powState, status);
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
			await refreshDebugState(subscription);
		} catch (error) {
			onError(error instanceof Error ? error.message : '웹 푸시 상태 확인에 실패했습니다.');
		} finally {
			isLoading = false;
		}
	}

	async function enableWebPush() {
		if (isSubmitting || isSolvingPoW || !isSupported) return;

		onClearMessage();
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
				proof
			});

			isSubscribed = true;
			await refreshDebugState(subscription);
			onSuccess('브라우저 웹 푸시 알림이 활성화되었습니다.');
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
			await refreshDebugState(currentSubscription);

			isSolvingPoW = false;
			powState = createPowDisplayState();
			onError(error instanceof Error ? error.message : '웹 푸시 활성화에 실패했습니다.');
		} finally {
			isSubmitting = false;
			if (!isSolvingPoW) {
				powState = createPowDisplayState();
			}
		}
	}

	async function disableWebPush() {
		if (isSubmitting || !isSupported) return;

		onClearMessage();
		isSubmitting = true;

		try {
			const subscription = await detectCurrentSubscription();

			if (subscription) {
				const endpoint = subscription.endpoint;
				await subscription.unsubscribe();
				await apiClient.unregisterWebPushSubscription(endpoint);
			}

			isSubscribed = false;
			await refreshDebugState(null);
			onSuccess('브라우저 웹 푸시 알림이 해지되었습니다.');
		} catch (error) {
			onError(error instanceof Error ? error.message : '웹 푸시 해지에 실패했습니다.');
		} finally {
			isSubmitting = false;
		}
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
	class="lc-panel-card mt-6 rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl"
>
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

		<div class="flex flex-col gap-3 sm:flex-row">
			<button
				type="button"
				on:click={enableWebPush}
				disabled={isSubmitting || isSolvingPoW || isSubscribed}
				class="lc-button-primary inline-flex cursor-pointer items-center justify-center rounded-xl px-6 py-3 font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSolvingPoW}
					<FontAwesomeIcon
						icon={faShieldHalved}
						class="pointer-events-none mr-2 h-4 w-4 animate-pulse"
					/>
					스팸 방지 검증 중...
				{:else if isSubmitting && !isSubscribed}
					<FontAwesomeIcon icon={faSpinner} class="pointer-events-none mr-2 h-4 w-4 animate-spin" />
					처리 중...
				{:else}
					<FontAwesomeIcon icon={faBell} class="pointer-events-none mr-2 h-4 w-4" />
					웹 푸시 동의 및 활성화
				{/if}
			</button>

			<button
				type="button"
				on:click={disableWebPush}
				disabled={isSubmitting || !isSubscribed}
				class="lc-button-secondary inline-flex cursor-pointer items-center justify-center rounded-xl border px-6 py-3 font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting && isSubscribed}
					<FontAwesomeIcon icon={faSpinner} class="pointer-events-none mr-2 h-4 w-4 animate-spin" />
					처리 중...
				{:else}
					<FontAwesomeIcon icon={faBellSlash} class="pointer-events-none mr-2 h-4 w-4" />
					웹 푸시 해지
				{/if}
			</button>
		</div>

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

		<p class="lc-text-muted mt-3 text-sm">
			현재 상태: {isSubscribed ? '활성화됨' : '비활성화됨'}
		</p>

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
