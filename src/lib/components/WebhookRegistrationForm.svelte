<script lang="ts">
	import { apiClient } from '$lib/api/client';
	import { executePowInWorker, type PowStatus } from '$lib/hashguard-worker';
	import { applyPowStatus, createPowDisplayState } from '$lib/utils/pow-status';
	import { validateDiscordWebhookUrl, normalizeWebhookUrl } from '$lib/utils/helpers';
	import WebhookGuide from './WebhookGuide.svelte';
	import PoWChallengeStatus from './PoWChallengeStatus.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faSpinner, faShieldHalved, faPlus } from '@fortawesome/free-solid-svg-icons';
	import { faDiscord } from '@fortawesome/free-brands-svg-icons';
	import type { SystemStats } from '$lib/types/api';

	// Props
	export let isInitialLoading = false;
	export let stats: SystemStats | undefined = undefined;
	export let onSuccess: (message: string) => void = () => {};
	export let onError: (message: string) => void = () => {};
	export let onClearMessage: () => void = () => {};
	export let onWebhookRegistered: () => void = () => {};

	let newWebhookUrl = '';
	let isSubmitting = false;
	let isSolvingPoW = false;
	let feedback: { type: 'success' | 'error'; message: string } | null = null;
	let powState = createPowDisplayState();

	function clearFeedback() {
		feedback = null;
		onClearMessage();
	}

	function showFeedback(type: 'success' | 'error', message: string) {
		feedback = { type, message };
		if (type === 'success') onSuccess(message);
		else onError(message);
	}

	function updatePowStatus(status: PowStatus) {
		powState = applyPowStatus(powState, status);
	}

	async function addWebhook() {
		// 웹훅 URL 유효성 검증
		const validation = validateDiscordWebhookUrl(newWebhookUrl);
		if (!validation.isValid) {
			showFeedback('error', validation.message || '올바르지 않은 웹훅 URL입니다.');
			return;
		}

		// 중복 제출 방지
		if (isSubmitting || isSolvingPoW) {
			return;
		}

		isSubmitting = true;
		clearFeedback();

		try {
			// 스팸 방지 검증 수행
			isSolvingPoW = true;
			powState = createPowDisplayState('보안 검증을 준비하고 있어요...');

			const proof = await executePowInWorker('webhook-registration', updatePowStatus);
			isSolvingPoW = false;
			powState = createPowDisplayState();

			// URL 정규화
			const normalizedUrl = normalizeWebhookUrl(newWebhookUrl);

			const result = await apiClient.registerWebhook({
				url: normalizedUrl,
				proof: proof
			});

			if (result.success) {
				showFeedback('success', result.message || '웹훅이 성공적으로 등록되었습니다.');
				newWebhookUrl = '';
				onWebhookRegistered(); // 통계 업데이트를 위한 이벤트
			} else {
				showFeedback('error', result.message || '웹훅 등록에 실패했습니다.');
			}
		} catch (err: unknown) {
			isSolvingPoW = false;
			powState = createPowDisplayState();
			if (err instanceof Error) {
				showFeedback('error', err.message);
			} else {
				showFeedback('error', '예상치 못한 오류가 발생했습니다.');
			}
		} finally {
			isSubmitting = false;
			if (!isSolvingPoW) {
				powState = createPowDisplayState();
			}
		}
	}
</script>

<div
	class="lc-panel-card rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl"
>
	<h2 class="lc-text-primary mb-6 flex items-center text-xl font-bold tracking-tight">
		<div class="lc-icon-accent-primary mr-3 rounded-lg p-2">
			<FontAwesomeIcon icon={faDiscord} class="lc-text-on-accent h-5 w-5" />
		</div>
		디스코드 웹훅 등록
	</h2>

	{#if feedback}
		<div
			class={`mb-5 rounded-lg border p-3 text-sm ${
				feedback.type === 'success'
					? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
					: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
			}`}
			role={feedback.type === 'error' ? 'alert' : 'status'}
		>
			{feedback.message}
		</div>
	{/if}

	<ul class="lc-text-secondary mb-6 space-y-2 text-sm">
		<li class="flex items-start">
			<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
			10분마다 자동으로 새로운 입법예고를 확인합니다
		</li>
		<li class="flex items-start">
			<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
			새로운 입법예고 발견 시 디스코드 웹훅으로 알림을 전송합니다
		</li>
		<li class="flex items-start">
			<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
			로그인 없이 간단하게 디스코드 웹훅 URL만 등록하면 됩니다
		</li>
		{#if stats}
			<li class="lc-text-accent flex items-start font-medium">
				<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
				현재 {stats.webhooks.active.toLocaleString('ko-KR')}개의 채널에 알림을 전송하고 있습니다
			</li>
		{/if}
	</ul>

	<form on:submit|preventDefault={addWebhook} class="space-y-4">
		<div>
			<label for="webhook-url" class="lc-text-secondary mb-2 block text-sm font-medium">
				웹훅 URL <span class="text-red-400">*</span>
			</label>
			<input
				id="webhook-url"
				type="url"
				bind:value={newWebhookUrl}
				placeholder="https://discord.com/api/webhooks/..."
				class="lc-input lc-input-focus w-full rounded-xl border-2 px-4 py-3 shadow-sm transition-all duration-200"
				maxlength="500"
				autocomplete="off"
				spellcheck="false"
				required
			/>
			{#if newWebhookUrl && !validateDiscordWebhookUrl(newWebhookUrl).isValid}
				<p class="lc-text-danger mt-1 text-sm">
					{validateDiscordWebhookUrl(newWebhookUrl).message}
				</p>
			{/if}
		</div>

		<button
			type="submit"
			disabled={isSubmitting || isInitialLoading || isSolvingPoW}
			class="lc-button-primary flex w-full cursor-pointer items-center justify-center rounded-xl px-6 py-3 font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
		>
			{#if isSolvingPoW}
				<FontAwesomeIcon icon={faShieldHalved} class="mr-2 h-4 w-4 animate-pulse" />
				스팸 방지 검증 중...
			{:else if isSubmitting}
				<FontAwesomeIcon icon={faSpinner} class="mr-2 h-4 w-4 animate-spin" />
				등록 중...
			{:else}
				<FontAwesomeIcon icon={faPlus} class="mr-2 h-4 w-4" />
				웹훅 등록
			{/if}
		</button>
		{#if isSolvingPoW}
			<PoWChallengeStatus
				message={powState.message}
				estimatedRemainingMs={powState.estimatedRemainingMs}
				hashRate={powState.hashRate}
				difficultyBits={powState.difficultyBits}
			/>
		{/if}
	</form>

	<WebhookGuide />
</div>
