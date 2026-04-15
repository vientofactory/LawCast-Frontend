<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faRobot } from '@fortawesome/free-solid-svg-icons';

	export let summary: string;
	export let title = '핵심 내용 AI 요약';
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

	<p class="relative z-10 mt-2 text-xs font-semibold tracking-[0.12em] text-cyan-800/80">{title}</p>
	<p class="relative z-10 mt-1.5 text-sm leading-relaxed text-slate-800">{summary}</p>
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
