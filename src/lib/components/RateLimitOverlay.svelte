<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faRotateRight, faClock } from '@fortawesome/free-solid-svg-icons';

	let {
		visible = false,
		retryAfter = 0,
		onRetry,
		isRetrying = false
	}: {
		visible?: boolean;
		retryAfter?: number;
		onRetry?: () => void | Promise<void>;
		isRetrying?: boolean;
	} = $props();
</script>

{#if visible}
	<div class="lc-rate-limit-overlay" aria-live="polite">
		<div class="lc-rate-limit-overlay-backdrop absolute inset-0 z-20" aria-hidden="true"></div>
		<div class="lc-rate-limit-overlay-content pointer-events-auto z-30">
			<div class="lc-rate-limit-overlay-card">
				<div class="lc-rate-limit-overlay-icon">
					<FontAwesomeIcon icon={faClock} class="h-6 w-6" />
				</div>
				<p class="lc-rate-limit-overlay-title">요청이 너무 많습니다</p>
				{#if retryAfter > 0}
					<p class="lc-rate-limit-overlay-countdown">
						{retryAfter}초 후 다시 시도할 수 있습니다
					</p>
				{:else}
					<p class="lc-rate-limit-overlay-ready">잠시 후 다시 시도해주세요</p>
				{/if}
				{#if onRetry}
					<button
						type="button"
						onclick={onRetry}
						disabled={retryAfter > 0 || isRetrying}
						class="lc-rate-limit-overlay-btn"
					>
						<FontAwesomeIcon
							icon={faRotateRight}
							class={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : retryAfter > 0 ? 'animate-pulse' : ''}`}
						/>
						{#if isRetrying}
							다시 시도 중...
						{:else}
							다시 시도
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.lc-rate-limit-overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.lc-rate-limit-overlay-backdrop {
		background: rgba(255, 255, 255, 0.6);
		backdrop-filter: blur(6px);
	}

	:global(html[data-theme='dark']) .lc-rate-limit-overlay-backdrop {
		background: rgba(2, 6, 23, 0.62);
		backdrop-filter: blur(6px);
	}

	.lc-rate-limit-overlay-content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.lc-rate-limit-overlay-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 2.5rem;
		border-radius: 0.75rem;
		background: var(--lc-surface-elevated);
		border: 1px solid var(--lc-border-soft);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.12),
			0 2px 8px rgba(0, 0, 0, 0.06);
		text-align: center;
		max-width: 20rem;
		width: 100%;
	}

	:global(html[data-theme='dark']) .lc-rate-limit-overlay-card {
		background: rgba(17, 23, 29, 0.95);
		border-color: rgba(148, 163, 184, 0.25);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.45),
			0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.lc-rate-limit-overlay-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 9999px;
		background: #fee2e2;
		color: #dc2626;
	}

	:global(html[data-theme='dark']) .lc-rate-limit-overlay-icon {
		background: rgba(62, 28, 34, 0.8);
		color: #fca5a5;
	}

	.lc-rate-limit-overlay-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--lc-text-primary);
	}

	.lc-rate-limit-overlay-countdown {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 700;
		color: #92400e;
		font-variant-numeric: tabular-nums;
	}

	:global(html[data-theme='dark']) .lc-rate-limit-overlay-countdown {
		color: #fcd34d;
	}

	.lc-rate-limit-overlay-ready {
		margin: 0;
		font-size: 0.82rem;
		color: var(--lc-text-secondary);
	}

	.lc-rate-limit-overlay-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.25rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		background: var(--lc-surface-primary);
		border: 1px solid var(--lc-border-soft);
		color: var(--lc-text-primary);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 180ms ease;
	}

	.lc-rate-limit-overlay-btn:hover:not(:disabled) {
		background: var(--lc-surface-hover);
		border-color: rgba(96, 165, 250, 0.35);
		color: var(--lc-text-accent);
	}

	.lc-rate-limit-overlay-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
</style>
