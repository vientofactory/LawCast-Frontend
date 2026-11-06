<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
	import RateLimitOverlay from './RateLimitOverlay.svelte';
	import ServerOfflineState from './ServerOfflineState.svelte';
	import {
		getFailureKind,
		isServerUnavailable,
		FAILURE_PRESENTATION,
		type LoadErrorPayload
	} from '#lib/utils/request-failure.ts';
	let {
		error,
		retryAfter = 0,
		onRetry,
		isRetrying = false,
		testId = 'load-failure'
	}: {
		error?: LoadErrorPayload | null;
		retryAfter?: number;
		onRetry?: () => void | Promise<void>;
		isRetrying?: boolean;
		testId?: string;
	} = $props();
	let kind = $derived(getFailureKind(error));
	let presentation = $derived(FAILURE_PRESENTATION[kind]);
</script>

{#if error}
	{#if kind === 'rate-limit'}
		<RateLimitOverlay visible {retryAfter} {onRetry} {isRetrying} />
	{:else if isServerUnavailable(error)}
		<ServerOfflineState {error} {onRetry} {isRetrying} {testId} />
	{:else}
		<section
			class="lc-panel-inset lc-load-failure"
			role="alert"
			data-testid={testId}
			data-failure-kind={kind}
			aria-busy={isRetrying}
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="lc-text-warning h-5 w-5 shrink-0" />
			<div class="min-w-0 flex-1">
				<h2 class="lc-text-primary text-base font-bold">{presentation.title}</h2>
				<p class="lc-text-secondary mt-2 text-sm leading-relaxed">
					{error.message || presentation.guidance}
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#if presentation.retryable && onRetry}
						<button
							type="button"
							class="lc-button-neutral inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
							disabled={isRetrying}
							onclick={onRetry}
						>
							<FontAwesomeIcon
								icon={faRotateRight}
								class={isRetrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
							/>
							{isRetrying ? '다시 시도 중...' : '다시 시도'}
						</button>
					{/if}
					<a
						href="/notices"
						class="lc-button-neutral inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold"
						>입법예고 목록으로</a
					>
				</div>
			</div>
		</section>
	{/if}
{/if}

<style>
	.lc-load-failure {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		margin-block: 1rem;
		padding: clamp(1rem, 3vw, 1.5rem);
		border: 1px solid var(--lc-border-soft);
		border-radius: 0.5rem;
		overflow-wrap: anywhere;
	}
</style>
