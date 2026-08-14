<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faRobot, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

	export let summary: string | null = null;
	export let status: 'ready' | 'unavailable' | 'not_supported' | 'not_requested' = 'ready';

	$: isReady = status === 'ready' && !!summary?.trim();
</script>

{#if isReady}
	<div
		class="agent-summary-card lc-ai-panel relative mt-4 overflow-hidden rounded-xl border p-4 shadow-md"
	>
		<div class="relative z-10 flex items-center justify-between gap-2">
			<div
				class="lc-ai-badge inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
			>
				<FontAwesomeIcon icon={faRobot} class="mr-1.5 h-3.5 w-3.5" />
				핵심 내용 AI 요약
			</div>
		</div>
		<p class="lc-text-primary relative z-10 mt-1.5 text-sm leading-relaxed wrap-break-word">
			{summary}
		</p>
	</div>
{:else}
	<div class="lc-ai-warning relative z-10 mt-2 rounded-lg border p-3">
		<p class="lc-ai-warning-title flex items-center text-xs font-semibold">
			<FontAwesomeIcon icon={faTriangleExclamation} class="mr-1.5 h-3.5 w-3.5" />
			AI 요약 생성이 일시적으로 지연되었거나 실패했습니다.
		</p>
		<p class="lc-ai-warning-body mt-1 text-xs leading-relaxed wrap-break-word">
			원문(제안이유 및 주요내용)을 기준으로 먼저 확인해주세요. 이후 재시도 시 요약이 표시될 수
			있습니다.
		</p>
	</div>
{/if}

<style>
	.agent-summary-card {
		box-shadow: none;
	}
</style>
