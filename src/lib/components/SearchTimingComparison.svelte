<script lang="ts">
	import DevDebugPanel from '#lib/components/DevDebugPanel.svelte';
	import type { Snippet } from 'svelte';
	import type { SearchTiming } from '#lib/utils/search-timing.ts';
	import { compareSearchTimings } from '#lib/utils/search-timing-comparison.ts';

	let {
		baseline,
		latest,
		toolbar
	}: { baseline: SearchTiming; latest: SearchTiming; toolbar?: Snippet } = $props();
	const comparison = $derived(compareSearchTimings(baseline, latest));
	const duration = (ms: number) => `${ms.toFixed(2)} ms`;
	const percent = (ms: number) => `${Math.min(100, (ms / (comparison.axisMs || 1)) * 100)}%`;
	const deltaLabel = (delta?: number) =>
		delta === undefined
			? '비교할 값 없음'
			: delta < 0
				? `−${duration(-delta)} 빨라짐`
				: delta > 0
					? `+${duration(delta)} 느려짐`
					: '차이 없음';
</script>

<DevDebugPanel
	title="Search Timing"
	{toolbar}
	testId="search-timing-comparison"
	entries={[
		{
			label: '전체 시간 차이',
			value: deltaLabel(comparison.rows.find(({ key }) => key === 'total')?.deltaMs)
		}
	]}
	description="차이는 최신 − 이전입니다. 호출 경로·k·응답 상태와 같은 유형의 발생 순서가 일치할 때만 비교합니다. 점선 막대는 시작 위치가 추정된 구간입니다."
>
	<div
		class="mt-2 border-t border-(--lc-border-soft) pt-2"
		data-testid="search-comparison-axis"
		data-axis-ms={comparison.axisMs}
	>
		<div class="grid grid-cols-2 gap-2">
			{#each [{ label: '이전 요청', record: baseline }, { label: '최신 요청', record: latest }] as item (item.label)}
				<div class="min-w-0">
					<p class="font-semibold" class:lc-text-accent={item.label === '최신 요청'}>
						{item.label}
					</p>
					<p class="truncate" title={item.record.query}>{item.record.query}</p>
					<div class="mt-1 flex justify-between gap-1 font-mono text-xs tabular-nums">
						<span>0 ms</span>
						<span>{duration(comparison.axisMs)}</span>
					</div>
				</div>
			{/each}
		</div>
		<ol class="mt-2 divide-y divide-(--lc-border-soft)">
			{#each comparison.rows as row (row.key)}
				<li class="py-1.5" data-testid="search-comparison-row" data-metric-key={row.key}>
					<div class="flex flex-wrap justify-between gap-x-2">
						<span class="font-semibold">{row.label}</span>
						<span
							data-testid="search-comparison-delta"
							class={[
								'font-mono text-xs tabular-nums',
								row.deltaMs !== undefined && row.deltaMs < 0 && 'text-(--lc-status-success)',
								row.deltaMs !== undefined && row.deltaMs > 0 && 'text-(--lc-status-error)'
							]}>{deltaLabel(row.deltaMs)}</span
						>
					</div>
					<div class="mt-1 grid grid-cols-2 gap-2">
						{#each [row.previous, row.current] as metric, index (index)}
							<div
								class="min-w-0"
								data-testid={index === 0
									? 'search-comparison-previous'
									: 'search-comparison-latest'}
							>
								<p class="font-mono text-xs tabular-nums">
									<span class="sr-only">{index === 0 ? '이전:' : '최신:'}</span>
									{metric ? duration(metric.durationMs) : '기록 없음'}
									{#if metric && metric.startMs === undefined}
										<span class="font-sans">(위치 정보 없음)</span>
									{/if}
								</p>
								<div
									class="relative mt-0.5 h-1.5 rounded bg-(--lc-surface-muted)"
									aria-hidden="true"
								>
									<span class="absolute inset-y-0 left-1/2 border-l border-(--lc-border-strong)"
									></span>
									{#if metric?.startMs !== undefined && metric.durationMs > 0}
										<span
											data-testid="search-comparison-bar"
											class={[
												'absolute inset-y-0 min-w-px rounded',
												index === 0 ? 'bg-(--lc-text-muted)' : 'bg-(--lc-text-accent)',
												metric.estimated && 'border border-dashed border-(--lc-surface-elevated)'
											]}
											style:left={percent(metric.startMs)}
											style:width={percent(
												Math.max(0, Math.min(metric.durationMs, comparison.axisMs - metric.startMs))
											)}
										></span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</li>
			{/each}
		</ol>
	</div>
</DevDebugPanel>
