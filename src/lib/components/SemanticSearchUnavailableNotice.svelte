<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

	// Health is advisory: only the search response decides whether keyword fallback is needed.
	let { visible = false, reason = '' }: { visible?: boolean; reason?: string } = $props();
</script>

{#if visible}
	<div
		class="lc-panel-card mb-4 flex items-start gap-3 rounded-lg border p-4"
		role="status"
		data-testid="semantic-search-unavailable-notice"
	>
		<FontAwesomeIcon icon={faTriangleExclamation} class="lc-text-warning mt-1 h-4 w-4 shrink-0" />
		<div>
			<p class="lc-text-primary font-semibold">의미 검색 상태를 확인해 주세요</p>
			<p class="lc-text-secondary mt-1 text-sm">{reason}</p>
			<p class="lc-text-secondary mt-1 text-sm">
				검색은 계속 이용할 수 있습니다. 엔진에 연결되지 않으면 키워드로 검색합니다.
			</p>
		</div>
	</div>
{/if}
