<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

	/**
	 * Covering overlay for an unavailable semantic search engine. Fills its
	 * nearest positioned ancestor (the search page's relative wrapper), so the
	 * form and results underneath are visually and physically covered while
	 * `visible` — the reason line says which case (not ready vs. status
	 * unreachable) the user is looking at.
	 */
	let { visible = false, reason = '' }: { visible?: boolean; reason?: string } = $props();
</script>

{#if visible}
	<div
		class="lc-semantic-unavailable-overlay"
		role="alert"
		data-testid="semantic-search-unavailable-overlay"
	>
		<div class="lc-semantic-unavailable-backdrop" aria-hidden="true"></div>
		<div class="lc-semantic-unavailable-content">
			<div class="lc-semantic-unavailable-card">
				<div class="lc-semantic-unavailable-icon">
					<FontAwesomeIcon icon={faTriangleExclamation} class="h-6 w-6" />
				</div>
				<p class="lc-semantic-unavailable-title">지금은 의미 검색을 사용할 수 없습니다</p>
				<p class="lc-semantic-unavailable-reason">{reason}</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.lc-semantic-unavailable-overlay {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.lc-semantic-unavailable-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(255, 255, 255, 0.72);
		backdrop-filter: blur(6px);
	}

	:global(html[data-theme='dark']) .lc-semantic-unavailable-backdrop {
		background: rgba(2, 6, 23, 0.72);
		backdrop-filter: blur(6px);
	}

	.lc-semantic-unavailable-content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		max-width: 24rem;
		width: 100%;
	}

	.lc-semantic-unavailable-card {
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
		width: 100%;
	}

	:global(html[data-theme='dark']) .lc-semantic-unavailable-card {
		background: rgba(17, 23, 29, 0.95);
		border-color: rgba(148, 163, 184, 0.25);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.45),
			0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.lc-semantic-unavailable-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 9999px;
		background: #fee2e2;
		color: #dc2626;
	}

	:global(html[data-theme='dark']) .lc-semantic-unavailable-icon {
		background: rgba(62, 28, 34, 0.8);
		color: #fca5a5;
	}

	.lc-semantic-unavailable-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--lc-text-primary);
	}

	.lc-semantic-unavailable-reason {
		margin: 0;
		font-size: 0.82rem;
		color: var(--lc-text-secondary);
	}
</style>
