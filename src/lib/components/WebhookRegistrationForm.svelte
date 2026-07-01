<script lang="ts">
	import { apiClient } from '$lib/api/client';
	import { executePowInWorker, type PowStatus } from '$lib/hashguard-worker';
	import { validateDiscordWebhookUrl, normalizeWebhookUrl } from '$lib/utils/helpers';
	import WebhookGuide from './WebhookGuide.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faSpinner, faShieldHalved, faLink, faPlus } from '@fortawesome/free-solid-svg-icons';
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
	let powStatusMessage = '';
	let powAttempts: number | null = null;
	let powDifficultyBits: number | null = null;
	let powHashRate: number | null = null;
	let powEstimatedRemainingMs: number | null = null;

	function formatHashRate(rate: number): string {
		if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(1)} MH/s`;
		if (rate >= 1_000) return `${Math.round(rate / 1_000).toLocaleString()} kH/s`;
		return `${Math.round(rate).toLocaleString()} H/s`;
	}

	function formatRemainingTime(ms: number): string {
		if (ms >= 60_000) return `약 ${Math.ceil(ms / 60_000)}분`;
		if (ms >= 10_000) return `약 ${Math.ceil(ms / 1_000)}초`;
		return '잠시 후 완료';
	}

	function updatePowStatus(status: PowStatus) {
		powStatusMessage = status.message;
		powAttempts = status.attempts ?? powAttempts;
		powDifficultyBits = status.difficultyBits ?? powDifficultyBits;
		if (status.hashRate !== undefined) powHashRate = status.hashRate;
		if (status.estimatedRemainingMs !== undefined)
			powEstimatedRemainingMs = status.estimatedRemainingMs;
	}

	async function addWebhook() {
		// 웹훅 URL 유효성 검증
		const validation = validateDiscordWebhookUrl(newWebhookUrl);
		if (!validation.isValid) {
			onError(validation.message || '올바르지 않은 웹훅 URL입니다.');
			return;
		}

		// 중복 제출 방지
		if (isSubmitting || isSolvingPoW) {
			return;
		}

		isSubmitting = true;
		onClearMessage();

		try {
			// 스팸 방지 검증 수행
			isSolvingPoW = true;
			powStatusMessage = '보안 검증을 준비하고 있어요...';
			powAttempts = null;
			powDifficultyBits = null;
			powHashRate = null;
			powEstimatedRemainingMs = null;

			const proof = await executePowInWorker('webhook-registration', updatePowStatus);
			isSolvingPoW = false;
			powStatusMessage = '';

			// URL 정규화
			const normalizedUrl = normalizeWebhookUrl(newWebhookUrl);

			const result = await apiClient.registerWebhook({
				url: normalizedUrl,
				proof: proof
			});

			if (result.success) {
				onSuccess(result.message || '웹훅이 성공적으로 등록되었습니다.');
				newWebhookUrl = '';
				onWebhookRegistered(); // 통계 업데이트를 위한 이벤트
			} else {
				onError(result.message || '웹훅 등록에 실패했습니다.');
			}
		} catch (err: unknown) {
			isSolvingPoW = false;
			powStatusMessage = '';
			powAttempts = null;
			powDifficultyBits = null;
			powHashRate = null;
			powEstimatedRemainingMs = null;
			if (err instanceof Error) {
				onError(err.message);
			} else {
				onError('예상치 못한 오류가 발생했습니다.');
			}
		} finally {
			isSubmitting = false;
			if (!isSolvingPoW) {
				powStatusMessage = '';
			}
		}
	}
</script>

<div
	class="lc-panel-card rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl"
>
	<h2 class="lc-text-primary mb-6 flex items-center text-xl font-bold tracking-tight">
		<div class="lc-icon-accent-primary mr-3 rounded-lg p-2">
			<FontAwesomeIcon icon={faLink} class="lc-text-on-accent h-5 w-5" />
		</div>
		웹훅 등록
	</h2>

	<ul class="lc-text-secondary mb-6 space-y-2 text-sm">
		<li class="flex items-start">
			<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
			10분마다 자동으로 새로운 입법예고를 확인합니다
		</li>
		<li class="flex items-start">
			<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
			새로운 입법예고 발견 시 Discord 웹훅으로 알림을 전송합니다
		</li>
		<li class="flex items-start">
			<span class="lc-loading-fill mt-1.5 mr-2 h-1.5 w-1.5 shrink-0 rounded-full"></span>
			로그인 없이 간단하게 Discord 웹훅 URL만 등록하면 됩니다
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
				Discord 웹훅 URL *
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
			<p class="lc-text-muted animate-pulse text-center text-xs">
				{powStatusMessage ||
					'잠시만 기다려주세요. 페이지를 새로고침하면 처음부터 다시 시작해야 합니다.'}
			</p>
			{#if powEstimatedRemainingMs !== null || powHashRate !== null || powDifficultyBits !== null}
				<div class="lc-text-dim flex items-center justify-center gap-2 text-[11px]">
					{#if powEstimatedRemainingMs !== null}
						<span class="lc-text-accent font-medium"
							>{formatRemainingTime(powEstimatedRemainingMs)}</span
						>
						<span>·</span>
					{/if}
					{#if powHashRate !== null}
						<span>{formatHashRate(powHashRate)}</span>
					{/if}
					{#if powDifficultyBits !== null}
						{#if powHashRate !== null}<span>·</span>{/if}
						<span>난이도 {powDifficultyBits}bit</span>
					{/if}
				</div>
			{/if}
		{/if}
	</form>

	<WebhookGuide />
</div>
