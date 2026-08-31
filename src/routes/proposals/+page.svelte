<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCalendarDays,
		faChartBar,
		faDatabase,
		faArrowsRotate,
		faInfoCircle,
		faCalendarWeek,
		faCalendar,
		faChartLine,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';
	import type { ProposalStatisticsData, ProposalStatisticsGranularity } from '$lib/types/api';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import { SvelteDate } from 'svelte/reactivity';

	export let data: PageData;

	$: statistics = data.statistics as ProposalStatisticsData;
	$: fetchedAt = data.fetchedAt;
	$: error = data.error;

	let chartCanvas: HTMLCanvasElement | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let chartInstance: any = null;
	let currentGranularity: ProposalStatisticsGranularity = 'daily';
	let chartType: 'bar' | 'line' = 'bar';
	let startDate = '';
	let endDate = '';
	let isLoading = false;

	const GRANULARITY_OPTIONS: Array<{
		value: ProposalStatisticsGranularity;
		label: string;
		icon: typeof faCalendarDays;
	}> = [
		{ value: 'daily', label: '일별', icon: faCalendarDays },
		{ value: 'weekly', label: '주별', icon: faCalendarWeek },
		{ value: 'monthly', label: '월별', icon: faCalendar }
	];

	const CHART_TYPE_OPTIONS: Array<{
		value: 'bar' | 'line';
		label: string;
		icon: typeof faChartBar;
	}> = [
		{ value: 'bar', label: '막대 차트', icon: faChartBar },
		{ value: 'line', label: '선형 차트', icon: faChartLine }
	];

	const QUICK_RANGES: Array<{ label: string; days: number }> = [
		{ label: '최근 7일', days: 7 },
		{ label: '최근 30일', days: 30 },
		{ label: '최근 90일', days: 90 },
		{ label: '올해', days: 365 }
	];

	function formatNumber(n: number): string {
		return n.toLocaleString('ko-KR');
	}

	function formatPeriodLabel(period: string, granularity: ProposalStatisticsGranularity): string {
		if (granularity === 'daily') {
			// YYYY-MM-DD -> MM/DD
			const parts = period.split('-');
			if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
			return period;
		}
		if (granularity === 'weekly') {
			// YYYY-Wxx -> YYYY Wxx
			return period.replace('W', ' W');
		}
		// monthly: YYYY-MM
		return period;
	}

	function applyQuickRange(days: number) {
		const now = new SvelteDate();
		const start = new SvelteDate();
		start.setDate(now.getDate() - days);
		startDate = start.toISOString().split('T')[0];
		endDate = now.toISOString().split('T')[0];
		loadStatistics();
	}

	function clearRange() {
		startDate = '';
		endDate = '';
		loadStatistics();
	}

	function updateGranularity(g: ProposalStatisticsGranularity) {
		currentGranularity = g;
		loadStatistics();
	}

	function updateChartType(t: 'bar' | 'line') {
		chartType = t;
		// Re-render chart without re-fetching data
		if (browser && statistics?.buckets?.length) {
			renderChart();
		}
	}

	function buildUrl(): string {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const params = new URLSearchParams();
		params.set('granularity', currentGranularity);
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		return `/proposals?${params.toString()}`;
	}

	async function loadStatistics() {
		isLoading = true;
		try {
			await goto(buildUrl(), { replaceState: true, noScroll: true });
		} finally {
			isLoading = false;
		}
	}

	function destroyChart() {
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}
	}

	async function renderChart() {
		if (!browser || !chartCanvas || !statistics?.buckets?.length) return;

		destroyChart();

		const { Chart, registerables } = await import('chart.js');
		await import('chartjs-adapter-date-fns');
		Chart.register(...registerables);

		const labels = statistics.buckets.map((b) =>
			formatPeriodLabel(b.period, statistics.granularity)
		);
		const values = statistics.buckets.map((b) => b.count);
		const maxVal = Math.max(...values, 0);

		const isDark =
			typeof document !== 'undefined' &&
			document.documentElement.getAttribute('data-theme') === 'dark';

		const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)';
		const textColor = isDark ? '#c0c9d3' : '#475569';
		const barColor = isDark ? 'rgba(138, 164, 196, 0.72)' : 'rgba(37, 99, 235, 0.7)';
		const barBorderColor = isDark ? 'rgba(138, 164, 196, 0.9)' : 'rgba(37, 99, 235, 0.9)';
		const lineColor = isDark ? 'rgba(138, 164, 196, 0.9)' : 'rgba(37, 99, 235, 0.9)';
		const lineFillColor = isDark ? 'rgba(138, 164, 196, 0.15)' : 'rgba(37, 99, 235, 0.1)';

		const isBar = chartType === 'bar';

		const dataset = isBar
			? {
					label: '발의 건수',
					data: values,
					backgroundColor: barColor,
					borderColor: barBorderColor,
					borderWidth: 1,
					borderRadius: 4,
					maxBarThickness: 48
				}
			: {
					label: '발의 건수',
					data: values,
					borderColor: lineColor,
					backgroundColor: lineFillColor,
					borderWidth: 2,
					fill: true,
					tension: 0.35,
					pointRadius: values.length > 60 ? 0 : 3,
					pointHoverRadius: values.length > 60 ? 5 : 6,
					pointBackgroundColor: lineColor,
					pointBorderColor: isDark ? 'rgba(17, 23, 29, 0.8)' : 'rgba(255, 255, 255, 0.9)',
					pointBorderWidth: 2
				};

		chartInstance = new Chart(chartCanvas, {
			type: chartType,
			data: {
				labels,
				datasets: [dataset]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: isDark ? 'rgba(17, 23, 29, 0.95)' : 'rgba(255, 255, 255, 0.98)',
						titleColor: isDark ? '#e5e7eb' : '#0f172a',
						bodyColor: isDark ? '#c0c9d3' : '#475569',
						borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
						borderWidth: 1,
						cornerRadius: 8,
						padding: 12,
						titleFont: { weight: 700 },
						callbacks: {
							label: (ctx: { parsed: { y: number | null } }) =>
								` ${formatNumber(ctx.parsed.y ?? 0)}건`
						}
					}
				},
				scales: {
					x: {
						grid: {
							color: gridColor,
							drawTicks: false
						},
						ticks: {
							color: textColor,
							font: { size: 11 },
							maxRotation: 45,
							autoSkip: true,
							maxTicksLimit: 30
						},
						border: { color: gridColor }
					},
					y: {
						beginAtZero: true,
						grid: {
							color: gridColor,
							drawTicks: false
						},
						ticks: {
							color: textColor,
							font: { size: 11 },
							stepSize: maxVal > 100 ? undefined : 1,
							callback: (tick: string | number) => formatNumber(Number(tick))
						},
						border: { color: gridColor }
					}
				}
			}
		});
	}

	$: if (browser && statistics?.buckets?.length) {
		// Defer to next tick so canvas is in DOM
		Promise.resolve().then(() => renderChart());
	}

	// Watch for theme changes to re-render chart
	function handleThemeChange() {
		if (browser && statistics?.buckets?.length) {
			renderChart();
		}
	}

	onMount(() => {
		if (!browser) return;
		const observer = new MutationObserver(() => handleThemeChange());
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		return () => observer.disconnect();
	});

	onDestroy(() => {
		if (browser) destroyChart();
	});
</script>

<svelte:head>
	<title>LawCast - 법률안 발의 통계</title>
	<meta
		name="description"
		content="국회 법률안 발의 통계를 일별, 주별, 월별로 조회하고 그래프로 시각화합니다."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="LawCast - 법률안 발의 통계" />
	<meta
		property="og:description"
		content="국회 법률안 발의 통계를 일별, 주별, 월별로 조회하고 그래프로 시각화합니다."
	/>
</svelte:head>

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Hero -->
		<div class="lc-panel-hero mb-6 rounded-2xl border p-5">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="lc-text-info text-xs font-semibold tracking-wide">PROPOSAL STATISTICS</p>
					<h1 class="lc-text-primary mt-1 text-xl font-bold sm:text-2xl">법률안 발의 통계</h1>
					<p class="lc-text-secondary mt-1 text-sm">
						수집된 법률안 발의 건수를 기간별로 집계하고 그래프로 시각화합니다.
					</p>
				</div>
				<p class="lc-text-dim text-xs">
					마지막 조회: <span class="lc-text-primary font-semibold"
						>{formatDateTimeKST(fetchedAt)}</span
					>
				</p>
			</div>
		</div>

		{#if error}
			<div
				class="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
			>
				{error}
			</div>
		{/if}

		<!-- ── 필터 컨트롤 ─────────────────────────────────────────── -->
		<section class="lc-panel-card rounded-2xl border p-5 shadow-sm">
			<div class="mb-4 flex flex-wrap items-center gap-3">
				<h2 class="lc-text-primary flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faChartLine} class="lc-text-accent mr-2 h-4 w-4" />
					조회 설정
				</h2>
			</div>

			<!-- Granularity buttons -->
			<div class="mb-4">
				<p class="lc-text-muted mb-2 text-xs font-semibold">집계 단위</p>
				<div class="flex flex-wrap gap-2">
					{#each GRANULARITY_OPTIONS as option (option.value)}
						<button
							type="button"
							on:click={() => updateGranularity(option.value)}
							disabled={isLoading}
							class={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
								currentGranularity === option.value
									? 'border-[var(--lc-border-strong)] bg-[var(--lc-surface-accent)] text-[var(--lc-text-primary)]'
									: 'border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-primary)]'
							}`}
						>
							<FontAwesomeIcon icon={option.icon} class="h-3.5 w-3.5" />
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Chart type buttons -->
			<div class="mb-4">
				<p class="lc-text-muted mb-2 text-xs font-semibold">차트 유형</p>
				<div class="flex flex-wrap gap-2">
					{#each CHART_TYPE_OPTIONS as option (option.value)}
						<button
							type="button"
							on:click={() => updateChartType(option.value)}
							class={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
								chartType === option.value
									? 'border-[var(--lc-border-strong)] bg-[var(--lc-surface-accent)] text-[var(--lc-text-primary)]'
									: 'border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-primary)]'
							}`}
						>
							<FontAwesomeIcon icon={option.icon} class="h-3.5 w-3.5" />
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Quick ranges -->
			<div class="mb-4">
				<p class="lc-text-muted mb-2 text-xs font-semibold">빠른 기간</p>
				<div class="flex flex-wrap gap-2">
					{#each QUICK_RANGES as range (range.days)}
						<button
							type="button"
							on:click={() => applyQuickRange(range.days)}
							disabled={isLoading}
							class="lc-chip-cyan inline-flex cursor-pointer items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{range.label}
						</button>
					{/each}
					{#if startDate || endDate}
						<button
							type="button"
							on:click={clearRange}
							disabled={isLoading}
							class="lc-chip-muted inline-flex cursor-pointer items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
						>
							기간 해제
						</button>
					{/if}
				</div>
			</div>
			<!-- Custom date range -->
			<div class="date-range-row">
				<div>
					<label for="start-date" class="lc-text-muted mb-1 block text-xs font-semibold"
						>시작일</label
					>
					<input
						id="start-date"
						type="date"
						bind:value={startDate}
						class="lc-input lc-input-focus rounded-lg border px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="end-date" class="lc-text-muted mb-1 block text-xs font-semibold">종료일</label
					>
					<input
						id="end-date"
						type="date"
						bind:value={endDate}
						class="lc-input lc-input-focus rounded-lg border px-3 py-2 text-sm"
					/>
				</div>
				<button
					type="button"
					on:click={loadStatistics}
					disabled={isLoading}
					class="lc-button-primary inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
				>
					<FontAwesomeIcon
						icon={faArrowsRotate}
						class={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
					/>
					조회
				</button>
			</div>
		</section>

		<!-- ── 요약 카드 + 차트 + 테이블 영역 (로딩 오버레이 적용) -->
		<div class="relative mt-4">
			{#if isLoading}
				<div class="lc-loading-overlay absolute inset-0 z-10 rounded-2xl"></div>
				<div class="absolute inset-0 z-20 flex items-center justify-center">
					<div class="lc-panel-hero flex flex-col items-center gap-3 border px-6 py-5 shadow-xl">
						<div class="lc-spinner-ring h-6 w-6 animate-spin border-4 sm:h-8 sm:w-8"></div>
						<p class="lc-text-secondary text-xs font-semibold sm:text-sm">데이터 갱신 중...</p>
					</div>
				</div>
			{/if}

			<div class="mt-0 grid gap-4 md:grid-cols-2">
				<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
					<h2 class="lc-text-primary mb-3 flex items-center text-sm font-bold">
						<FontAwesomeIcon icon={faDatabase} class="lc-text-success mr-2 h-4 w-4" />
						전체 발의 건수
					</h2>
					<p class="lc-text-primary text-2xl font-bold sm:text-3xl">
						{formatNumber(statistics.totalCount)}
					</p>
					<p class="lc-text-dim mt-1 text-xs">
						{#if statistics.startDate || statistics.endDate}
							{#if statistics.startDate}
								{new Date(statistics.startDate).toLocaleDateString('ko-KR')}부터
							{/if}
							{#if statistics.endDate}
								~ {new Date(statistics.endDate).toLocaleDateString('ko-KR')}까지
							{/if}
						{:else}
							전체 기간
						{/if}
						기준
					</p>
				</section>

				<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
					<h2 class="lc-text-primary mb-3 flex items-center text-sm font-bold">
						<FontAwesomeIcon icon={faChartBar} class="lc-text-info mr-2 h-4 w-4" />
						집계 구간 수
					</h2>
					<p class="lc-text-primary text-2xl font-bold sm:text-3xl">
						{formatNumber(statistics.buckets.length)}
					</p>
					<p class="lc-text-dim mt-1 text-xs">
						{currentGranularity === 'daily'
							? '일'
							: currentGranularity === 'weekly'
								? '주'
								: '월'}별 구간
					</p>
				</section>

				<!-- ── 차트 ────────────────────────────────────────────────── -->
				{#if statistics.buckets.length > 0}
					<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
						<h2 class="lc-text-primary mb-4 flex items-center text-sm font-bold">
							<FontAwesomeIcon icon={faChartBar} class="lc-text-accent mr-2 h-4 w-4" />
							발의 건수 그래프
						</h2>
						<div class="chart-container">
							<canvas bind:this={chartCanvas}></canvas>
						</div>
					</section>

					<!-- ── 데이터 테이블 ────────────────────────────────────── -->
					<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
						<h2 class="lc-text-primary mb-4 flex items-center text-sm font-bold">
							<FontAwesomeIcon icon={faDatabase} class="lc-text-info mr-2 h-4 w-4" />
							상세 데이터
						</h2>
						<div class="table-scroll-wrapper">
							<table class="w-full text-sm">
								<thead class="table-scroll-thead">
									<tr class="border-b border-[var(--lc-border-soft)]">
										<th class="lc-text-muted px-4 py-2 text-left text-xs font-semibold"> 기간 </th>
										<th class="lc-text-muted px-4 py-2 text-right text-xs font-semibold">
											발의 건수
										</th>
										<th class="lc-text-muted px-4 py-2 text-right text-xs font-semibold"> 비율 </th>
									</tr>
								</thead>
								<tbody>
									{#each [...statistics.buckets].reverse() as bucket (bucket.period)}
										<tr class="lc-table-row border-b border-[var(--lc-border-soft)]">
											<td class="lc-text-primary px-4 py-2 font-semibold"
												>{formatPeriodLabel(bucket.period, statistics.granularity)}</td
											>
											<td class="lc-text-primary px-4 py-2 text-right font-semibold"
												>{formatNumber(bucket.count)}건</td
											>
											<td class="lc-text-secondary px-4 py-2 text-right">
												{statistics.totalCount > 0
													? ((bucket.count / statistics.totalCount) * 100).toFixed(1)
													: '0.0'}%
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{:else}
					<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
						<div class="lc-empty-state flex flex-col items-center justify-center py-12">
							<div
								class="lc-empty-state-icon mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
							>
								<FontAwesomeIcon icon={faChartBar} class="lc-text-muted h-8 w-8" />
							</div>
							<p class="lc-text-secondary text-sm font-semibold">표시할 데이터가 없습니다.</p>
							<p class="lc-text-dim mt-1 text-xs">기간 조건을 변경하거나 초기화해 보세요.</p>
						</div>
					</section>
				{/if}
			</div>
			<!-- .mt-0 grid -->
		</div>
		<!-- .relative mt-4 -->

		<!-- ── 안내 ──────────────────────────────────────────────────── -->
		<div class="lc-banner-warning rounded-xl border p-4 mt-4">
			<div class="mb-2 flex items-center gap-2">
				<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
				<span class="text-sm font-bold">데이터 해석에 유의하세요</span>
			</div>
			<div class="space-y-2 text-xs leading-relaxed">
				<p>
					이 통계는 LawCast가 법률안을 <strong>수집한 시점</strong>을 기준으로 집계한 것입니다. 실제
					국회 발의 시점과 수집 시점에는 시간차가 있을 수 있으며, 이로 인해 일별·주별·월별 분포가
					실제 발의 패턴과 다를 수 있습니다.
				</p>
				<p>
					또한 크롤러의 수집 주기, 네트워크 상황, 원본 게시판 데이터 가용성 등에 따라 수집이
					지연되거나 누락될 수 있습니다.
				</p>
				<p class="font-semibold">
					정확한 법률안 발의 통계는
					<a
						href="https://kosis.kr"
						target="_blank"
						rel="noopener noreferrer"
						class="lc-link underline">통계청(KOSIS)</a
					>
					또는
					<a
						href="https://pal.assembly.go.kr"
						target="_blank"
						rel="noopener noreferrer"
						class="lc-link underline">국회 입법예고 시스템</a
					>의 공식 정보를 확인하시기 바랍니다.
				</p>
			</div>
		</div>
	</main>
</div>

<style>
	/* ── Chart container: responsive height ─────────────────────── */
	.chart-container {
		position: relative;
		width: 100%;
		height: 280px;
	}

	@media (min-width: 640px) {
		.chart-container {
			height: 340px;
		}
	}

	@media (min-width: 1024px) {
		.chart-container {
			height: 400px;
		}
	}

	/* ── Date range row: stack on small, inline on larger ──────── */
	.date-range-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.date-range-row > div {
		min-width: 0;
		flex: 1 1 auto;
	}

	@media (min-width: 640px) {
		.date-range-row > div {
			flex: 0 0 auto;
		}
	}

	.date-range-row input[type='date'] {
		width: 100%;
	}

	@media (min-width: 640px) {
		.date-range-row input[type='date'] {
			width: auto;
		}
	}

	/* ── Table scroll wrapper: responsive height ───────────────── */
	.table-scroll-wrapper {
		max-height: 280px;
		overflow-y: auto;
		border: 1px solid var(--lc-border-soft);
		border-radius: 0.5rem;
		-webkit-overflow-scrolling: touch;
	}

	@media (min-width: 640px) {
		.table-scroll-wrapper {
			max-height: 340px;
		}
	}

	@media (min-width: 1024px) {
		.table-scroll-wrapper {
			max-height: 400px;
		}
	}

	.table-scroll-wrapper :global(thead.table-scroll-thead) {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--lc-surface-primary);
	}

	.table-scroll-wrapper::-webkit-scrollbar {
		width: 6px;
	}

	.table-scroll-wrapper::-webkit-scrollbar-track {
		background: transparent;
	}

	.table-scroll-wrapper::-webkit-scrollbar-thumb {
		background: var(--lc-border-soft);
		border-radius: 3px;
	}

	.table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
		background: var(--lc-text-muted);
	}
</style>
