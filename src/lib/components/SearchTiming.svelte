<script lang="ts">
	import DevDebugPanel from '#lib/components/DevDebugPanel.svelte';
	import type { SearchTiming } from '#lib/api/client.ts';
	import type { Snippet } from 'svelte';
	import { buildSearchWaterfall } from '#lib/utils/search-waterfall.ts';
	import { readDenseStages } from '#lib/utils/search-timing.ts';

	let { timing, toolbar }: { timing: SearchTiming; toolbar?: Snippet } = $props();

	const outcomes = { success: '완료', error: '실패', timeout: '시간 초과' };
	const callOutcomes = { ok: '완료', error: '실패', pending: '진행 중' };
	const duration = (ms?: number) => (ms === undefined ? '측정값 없음' : `${ms.toFixed(2)} ms`);
	const waterfall = $derived(buildSearchWaterfall(timing));
	const percent = (ms: number) => `${Math.min(100, (ms / (waterfall.total || 1)) * 100)}%`;
	const colors = {
		frontend: 'var(--lc-text-accent)',
		backend: 'var(--lc-text-secondary)',
		request: 'var(--lc-text-muted)',
		sidecar: 'color-mix(in srgb, var(--lc-text-accent) 68%, var(--lc-text-secondary))',
		phase: 'var(--lc-text-primary)'
	};
</script>

<DevDebugPanel
	title="Search Timing"
	{toolbar}
	testId="search-timing"
	entries={[
		{
			label: 'SvelteKit 전체',
			value: duration(timing.sveltekitMs),
			testId: 'search-timing-duration'
		},
		{
			label: 'Backend 응답 헤더까지',
			value: duration(timing.backend?.backendMs),
			testId: 'search-timing-backend'
		},
		{
			label: '요청 상태',
			value:
				outcomes[timing.outcome] + (timing.status === undefined ? '' : ` (HTTP ${timing.status})`),
			testId: 'search-timing-status'
		},
		{ label: 'traceId', value: timing.traceId, wrap: true, testId: 'search-timing-id' }
	]}
	description="SvelteKit 전체 시간은 응답 본문 처리까지입니다. 각 구간은 서로 포함되므로 합산하지 않습니다."
>
	<div class="mt-2 border-t border-(--lc-border-soft) pt-2" data-testid="search-timing-waterfall">
		<p class="font-semibold">요청 워터폴</p>
		{#if waterfall.longest}
			<p class="lc-text-accent mt-1 font-semibold" data-testid="search-timing-longest">
				가장 긴 상세 구간: {waterfall.longest.label} · {duration(waterfall.longest.durationMs)}
			</p>
		{/if}
		<div aria-hidden="true" class="mt-2 flex justify-between font-mono tabular-nums">
			<span>0 ms</span>
			<span>{duration(waterfall.total / 2)}</span>
			<span>{duration(waterfall.total)}</span>
		</div>
		<ol class="mt-1 space-y-1.5">
			{#each waterfall.spans as span (span.id)}
				<li
					data-testid={`search-span-${span.id}`}
					data-start-ms={span.startMs}
					data-duration-ms={span.durationMs}
				>
					<div
						class="flex flex-wrap justify-between gap-x-1"
						style:padding-inline-start={`${span.depth * 0.375}rem`}
					>
						<span class:font-semibold={span.id === waterfall.longest?.id}>{span.label}</span>
						<span class="font-mono tabular-nums">{duration(span.durationMs)}</span>
					</div>
					<div class="relative mt-0.5 h-1.5 rounded bg-(--lc-surface-muted)" aria-hidden="true">
						<span class="absolute inset-y-0 left-1/2 border-l border-(--lc-border-strong)"></span>
						{#if span.durationMs > 0}
							<span
								class={[
									'absolute inset-y-0 min-w-px rounded',
									span.estimated && 'border border-dashed border-(--lc-surface-elevated)'
								]}
								style:background={colors[span.kind]}
								style:left={percent(span.startMs)}
								style:width={percent(
									Math.max(0, Math.min(span.durationMs, waterfall.total - span.startMs))
								)}
							></span>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
		<p class="lc-text-muted mt-2">
			점선은 서버 간 시계가 달라 시작 위치를 추정한 구간입니다. 막대 길이는 측정 시간입니다. 왕복 중
			내부 처리 외 시간은 왕복 시간에서 서버 처리 시간을 뺀 값입니다.
		</p>
	</div>
	<div class="mt-2 border-t border-(--lc-border-soft) pt-2" data-testid="search-timing-sidecar">
		<p class="font-semibold">Sidecar 호출 내역</p>
		{#if !timing.backend}
			<p class="lc-text-muted mt-1">백엔드 타이밍 정보가 없습니다.</p>
		{:else if timing.backend.sidecarCalls.length === 0}
			<p class="lc-text-muted mt-1">이 요청은 사이드카를 호출하지 않았습니다.</p>
		{:else}
			<ol class="mt-1 space-y-2">
				{#each timing.backend.sidecarCalls as call, index (index)}
					<li
						class="rounded-sm border border-(--lc-border-soft) bg-(--lc-surface-inset) px-2 py-1.5"
						data-testid="search-timing-call"
					>
						<p class="flex flex-wrap items-baseline gap-x-2">
							<span class="font-mono font-semibold">
								#{index + 1}
								{call.path}{call.chunkK === undefined ? '' : ` · k=${call.chunkK}`}
							</span>
							<span>
								{callOutcomes[call.outcome]}{call.status === undefined
									? ''
									: ` (HTTP ${call.status})`}
							</span>
						</p>
						<dl class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
							<div>
								<dt class="inline">Backend ↔ Sidecar 왕복:</dt>
								<dd class="inline font-mono tabular-nums">{duration(call.roundTripMs)}</dd>
							</div>
							{#if call.timings}
								<div>
									<dt class="inline">Dense:</dt>
									<dd class="inline font-mono tabular-nums">{duration(call.timings.denseMs)}</dd>
								</div>
								{#each readDenseStages(call.timings) ?? [] as stage (stage.key)}
									<div>
										<dt class="inline">{stage.label}:</dt>
										<dd class="inline font-mono tabular-nums">{duration(stage.durationMs)}</dd>
									</div>
									{#each stage.children ?? [] as child (child.key)}
										<div>
											<dt class="inline">{child.label}:</dt>
											<dd class="inline font-mono tabular-nums">{duration(child.durationMs)}</dd>
										</div>
									{/each}
								{/each}
								<div>
									<dt class="inline">Annotate:</dt>
									<dd class="inline font-mono tabular-nums">{duration(call.timings.annotateMs)}</dd>
								</div>
								<div>
									<dt class="inline">Sidecar 전체:</dt>
									<dd class="inline font-mono tabular-nums">{duration(call.timings.totalMs)}</dd>
								</div>
							{/if}
						</dl>
						{#if call.path === '/search' && !call.timings}
							<p class="lc-text-muted mt-1">사이드카 단계별 측정값 없음</p>
						{/if}
					</li>
				{/each}
			</ol>
			{#if timing.backend.omittedCalls > 0}
				<p class="mt-1">
					추가 호출 {timing.backend.omittedCalls}건은 백엔드 로그에서 확인할 수 있습니다.
				</p>
			{/if}
		{/if}
	</div>
</DevDebugPanel>
