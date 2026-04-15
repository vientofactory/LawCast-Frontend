<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faRobot, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

	export let summary: string | null = null;
	export let status: 'ready' | 'unavailable' | 'not_supported' | 'not_requested' = 'ready';
	export let title = '핵심 내용 AI 요약';

	$: isReady = status === 'ready' && !!summary?.trim();
</script>

<div
	class="agent-summary-card agent-scanline relative mt-4 overflow-hidden rounded-xl border border-cyan-200/70 bg-linear-to-br from-cyan-50 via-sky-50 to-indigo-50 p-4 shadow-md shadow-cyan-100/60"
>
	<div
		class="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl"
	></div>
	<div
		class="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-indigo-300/20 blur-2xl"
	></div>

	<div class="relative z-10 flex items-center justify-between gap-2">
		<div
			class="inline-flex items-center rounded-full border border-cyan-200 bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-cyan-700"
		>
			<FontAwesomeIcon icon={faRobot} class="mr-1.5 h-3.5 w-3.5" />
			AI 에이전트 브리핑
		</div>
	</div>

	<p
		class="relative z-10 mt-2 text-xs font-semibold tracking-[0.12em] [overflow-wrap:anywhere] break-words text-cyan-800/80"
	>
		{title}
	</p>

	{#if isReady}
		<p
			class="relative z-10 mt-1.5 text-sm leading-relaxed [overflow-wrap:anywhere] break-words text-slate-800"
		>
			{summary}
		</p>
	{:else}
		<div class="relative z-10 mt-2 rounded-lg border border-amber-200 bg-white/75 p-3">
			<p class="flex items-center text-xs font-semibold text-amber-800">
				<FontAwesomeIcon icon={faTriangleExclamation} class="mr-1.5 h-3.5 w-3.5" />
				AI 요약 생성이 일시적으로 지연되었거나 실패했습니다.
			</p>
			<p class="mt-1 text-xs leading-relaxed [overflow-wrap:anywhere] break-words text-amber-700">
				원문(제안이유 및 주요내용)을 기준으로 먼저 확인해주세요. 이후 재시도 시 요약이 표시될 수
				있습니다.
			</p>
		</div>
	{/if}
</div>

<style>
	.agent-summary-card {
		box-shadow: 0 10px 28px rgba(14, 165, 233, 0.14);
	}

	.agent-scanline::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0),
			rgba(34, 211, 238, 0.09),
			rgba(255, 255, 255, 0)
		);
		transform: translateY(-120%);
		animation: scan-line 3.2s linear infinite;
		pointer-events: none;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(0.9);
		}

		50% {
			opacity: 1;
			transform: scale(1.15);
		}
	}

	@keyframes scan-line {
		0% {
			transform: translateY(-120%);
		}

		100% {
			transform: translateY(120%);
		}
	}
</style>
