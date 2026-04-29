<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsRotate,
		faBolt,
		faBoxArchive,
		faCloud,
		faClock,
		faDatabase,
		faGear,
		faLink,
		faMicrochip,
		faRobot,
		faSquareCheck,
		faTriangleExclamation,
		faXmarkCircle,
		faArrowLeft,
		faArrowRight
	} from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';
	import type { OllamaHealthStatus, BatchRunRecord, BatchProcessingStats } from '$lib/types/api';

	export let data: PageData;

	$: stats = data.stats;
	$: fetchedAt = data.fetchedAt;
	$: error = data.error;

	let isRefreshing = false;

	$: ollamaHealthStatus = (stats.ollama?.health.status ?? 'unknown') as OllamaHealthStatus;
	$: hasOllamaIssue = ollamaHealthStatus === 'unhealthy' || ollamaHealthStatus === 'misconfigured';
	$: hasCacheIssue = stats.cache.isInitialized === false;
	$: hasBatchBacklog = (stats.batchProcessing?.jobCount ?? 0) > 0;
	$: batchIsShuttingDown =
		(stats.batchProcessing as { isShuttingDown?: boolean } | undefined)?.isShuttingDown ?? false;
	$: batchActiveTimeouts =
		(stats.batchProcessing as { activeTimeouts?: number } | undefined)?.activeTimeouts ?? 0;

	$: overallStatus = (hasOllamaIssue || hasCacheIssue ? 'degraded' : 'healthy') as
		| 'healthy'
		| 'degraded';
	$: overallLabel = overallStatus === 'healthy' ? '정상' : '주의 필요';

	function formatDateTime(value: string | null | undefined): string {
		if (!value) return 'N/A';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'N/A';
		return parsed.toLocaleString('ko-KR');
	}

	function statusStyle(status: OllamaHealthStatus | 'healthy' | 'degraded') {
		switch (status) {
			case 'healthy':
				return {
					badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
					icon: faSquareCheck
				};
			case 'degraded':
				return {
					badge: 'bg-amber-100 text-amber-800 border-amber-200',
					icon: faTriangleExclamation
				};
			case 'unhealthy':
				return {
					badge: 'bg-red-100 text-red-800 border-red-200',
					icon: faXmarkCircle
				};
			case 'misconfigured':
				return {
					badge: 'bg-orange-100 text-orange-800 border-orange-200',
					icon: faTriangleExclamation
				};
			case 'disabled':
				return {
					badge: 'bg-slate-100 text-slate-700 border-slate-200',
					icon: faCloud
				};
			default:
				return {
					badge: 'bg-gray-100 text-gray-700 border-gray-200',
					icon: faClock
				};
		}
	}

	$: recentJobs = ((stats.batchProcessing as BatchProcessingStats | undefined)?.recentJobs ??
		[]) as BatchRunRecord[];

	function formatDuration(ms: number | null | undefined): string {
		if (ms == null) return '-';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	function batchStatusStyle(status: BatchRunRecord['status']) {
		switch (status) {
			case 'completed':
				return 'bg-emerald-100 text-emerald-700 border-emerald-200';
			case 'failed':
				return 'bg-red-100 text-red-700 border-red-200';
			case 'running':
				return 'bg-blue-100 text-blue-700 border-blue-200';
			default:
				return 'bg-slate-100 text-slate-600 border-slate-200';
		}
	}

	function batchStatusLabel(status: BatchRunRecord['status']): string {
		switch (status) {
			case 'completed':
				return '완료';
			case 'failed':
				return '실패';
			case 'running':
				return '실행 중';
			default:
				return status;
		}
	}

	$: overallStyle = statusStyle(overallStatus);
	$: ollamaStyle = statusStyle(ollamaHealthStatus);

	async function refreshStatus() {
		isRefreshing = true;
		try {
			await invalidateAll();
		} finally {
			isRefreshing = false;
		}
	}
</script>

<svelte:head>
	<title>LawCast - 시스템 상태</title>
	<meta
		name="description"
		content="LawCast 시스템 상태 대시보드입니다. 웹훅, 캐시, 배치 처리, AI 요약 상태를 확인할 수 있습니다."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="LawCast - 시스템 상태" />
	<meta
		property="og:description"
		content="LawCast 시스템 상태 대시보드입니다. 웹훅, 캐시, 배치 처리, AI 요약 상태를 확인할 수 있습니다."
	/>
	<meta name="twitter:title" content="LawCast - 시스템 상태" />
	<meta
		name="twitter:description"
		content="LawCast 시스템 상태 대시보드입니다. 웹훅, 캐시, 배치 처리, AI 요약 상태를 확인할 수 있습니다."
	/>
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-cyan-50/30 to-emerald-50/30">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<div class="mb-6 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="text-xs font-semibold tracking-wide text-cyan-700">SYSTEM STATUS</p>
					<h1 class="mt-1 text-2xl font-bold text-slate-900">LawCast 시스템 상태</h1>
					<p class="mt-1 text-sm text-slate-600">
						마지막 조회: <span class="font-semibold text-slate-700"
							>{formatDateTime(fetchedAt)}</span
						>
					</p>
				</div>
				<div class="flex items-center gap-2">
					<span
						class={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${overallStyle.badge}`}
					>
						<FontAwesomeIcon icon={overallStyle.icon} class="h-3.5 w-3.5" />
						전체 상태 {overallLabel}
					</span>
					<button
						on:click={refreshStatus}
						disabled={isRefreshing}
						class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<FontAwesomeIcon
							icon={faArrowsRotate}
							class={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
						/>
						새로고침
					</button>
				</div>
			</div>
		</div>

		{#if error}
			<Alert type="error" message={error} onDismiss={() => {}} />
		{/if}

		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<section
				class="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
			>
				<h2 class="mb-3 flex items-center text-sm font-bold text-slate-900">
					<FontAwesomeIcon icon={faLink} class="mr-2 h-4 w-4 text-emerald-600" />
					웹훅 상태
				</h2>
				<div class="space-y-1 text-sm text-slate-700">
					<p>
						전체: <span class="font-semibold">{stats.webhooks.total.toLocaleString('ko-KR')}개</span
						>
					</p>
					<p>
						활성: <span class="font-semibold"
							>{stats.webhooks.active.toLocaleString('ko-KR')}개</span
						>
					</p>
					<p>
						효율: <span class="font-semibold"
							>{stats.webhooks.efficiency !== undefined
								? `${stats.webhooks.efficiency.toLocaleString('ko-KR')}%`
								: 'N/A'}</span
						>
					</p>
				</div>
			</section>

			<section
				class="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
			>
				<h2 class="mb-3 flex items-center text-sm font-bold text-slate-900">
					<FontAwesomeIcon icon={faDatabase} class="mr-2 h-4 w-4 text-blue-600" />
					캐시 상태
				</h2>
				<div class="space-y-1 text-sm text-slate-700">
					<p>
						캐시 크기: <span class="font-semibold">{stats.cache.size.toLocaleString('ko-KR')}</span>
					</p>
					<p>
						최대 크기: <span class="font-semibold"
							>{stats.cache.maxSize.toLocaleString('ko-KR')}</span
						>
					</p>
					<p>
						초기화: <span class="font-semibold">{stats.cache.isInitialized ? '완료' : '필요'}</span>
					</p>
					<p>
						마지막 갱신: <span class="font-semibold">{formatDateTime(stats.cache.lastUpdated)}</span
						>
					</p>
				</div>
			</section>

			<section
				class="rounded-2xl border border-violet-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
			>
				<h2 class="mb-3 flex items-center text-sm font-bold text-slate-900">
					<FontAwesomeIcon icon={faGear} class="mr-2 h-4 w-4 text-violet-600" />
					배치 처리
				</h2>
				<div class="space-y-1 text-sm text-slate-700">
					<p>
						실행 중 작업:
						<span class="font-semibold"
							>{(stats.batchProcessing?.jobCount ?? 0).toLocaleString('ko-KR')}</span
						>
					</p>
					<p>
						타임아웃 큐:
						<span class="font-semibold">{batchActiveTimeouts.toLocaleString('ko-KR')}</span>
					</p>
					<p>
						종료 절차:
						<span class="font-semibold">{batchIsShuttingDown ? '진행 중' : '정상'}</span>
					</p>
				</div>
			</section>

			<section
				class="rounded-2xl border border-cyan-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
			>
				<h2 class="mb-3 flex items-center text-sm font-bold text-slate-900">
					<FontAwesomeIcon icon={faRobot} class="mr-2 h-4 w-4 text-cyan-600" />
					AI 요약
				</h2>
				<div class="space-y-1 text-sm text-slate-700">
					<p>활성화: <span class="font-semibold">{stats.ollama?.enabled ? 'ON' : 'OFF'}</span></p>
					<p>
						설정됨: <span class="font-semibold">{stats.ollama?.configured ? 'YES' : 'NO'}</span>
					</p>
					<p>모델: <span class="font-semibold">{stats.ollama?.model || 'N/A'}</span></p>
					<p>
						상태:
						<span
							class={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ollamaStyle.badge}`}
						>
							{ollamaHealthStatus}
						</span>
					</p>
				</div>
			</section>
		</div>

		<div class="mt-4 grid gap-4 lg:grid-cols-2">
			<section
				class="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm"
			>
				<h2 class="mb-3 flex items-center text-base font-bold text-slate-900">
					<FontAwesomeIcon icon={faBolt} class="mr-2 h-4 w-4 text-amber-500" />
					요약 지표
				</h2>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<div class="rounded-xl bg-slate-50 p-3">
						<p class="text-xs text-slate-500">아카이브 수</p>
						<p class="mt-1 text-lg font-bold text-slate-900">
							{stats.archive.count.toLocaleString('ko-KR')}
						</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-3">
						<p class="text-xs text-slate-500">AI 요약 시도</p>
						<p class="mt-1 text-lg font-bold text-slate-900">
							{(stats.ollama?.summary.total ?? 0).toLocaleString('ko-KR')}
						</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-3">
						<p class="text-xs text-slate-500">AI 성공률</p>
						<p class="mt-1 text-lg font-bold text-slate-900">
							{(stats.ollama?.summary.successRate ?? 0).toLocaleString('ko-KR')}%
						</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-3">
						<p class="text-xs text-slate-500">AI 실패</p>
						<p class="mt-1 text-lg font-bold text-slate-900">
							{(stats.ollama?.summary.failed ?? 0).toLocaleString('ko-KR')}
						</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-3">
						<p class="text-xs text-slate-500">AI 스킵</p>
						<p class="mt-1 text-lg font-bold text-slate-900">
							{(stats.ollama?.summary.skipped ?? 0).toLocaleString('ko-KR')}
						</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-3">
						<p class="text-xs text-slate-500">작업 대기</p>
						<p class="mt-1 text-lg font-bold text-slate-900">
							{(stats.batchProcessing?.jobCount ?? 0).toLocaleString('ko-KR')}
						</p>
					</div>
				</div>
			</section>

			<section
				class="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm"
			>
				<h2 class="mb-3 flex items-center text-base font-bold text-slate-900">
					<FontAwesomeIcon icon={faMicrochip} class="mr-2 h-4 w-4 text-sky-600" />
					세부 상태
				</h2>
				<ul class="space-y-2 text-sm text-slate-700">
					<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
						<span>AI 요약 기능</span>
						<span class="font-semibold"
							>{stats.aiSummaryEnabled !== false ? '사용 중' : '비활성'}</span
						>
					</li>
					<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
						<span>마지막 점검</span>
						<span class="font-semibold">{formatDateTime(stats.ollama?.health.lastCheckedAt)}</span>
					</li>
					<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
						<span>지연 시간</span>
						<span class="font-semibold"
							>{stats.ollama?.health.lastLatencyMs !== null &&
							stats.ollama?.health.lastLatencyMs !== undefined
								? `${stats.ollama.health.lastLatencyMs.toLocaleString('ko-KR')}ms`
								: 'N/A'}</span
						>
					</li>
					<li class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
						<span>최근 배치 이력</span>
						<span class="font-semibold">{recentJobs.length.toLocaleString('ko-KR')}건</span>
					</li>
				</ul>
			</section>
		</div>

		{#if hasBatchBacklog || hasCacheIssue || hasOllamaIssue}
			<section class="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
				<h2 class="mb-2 flex items-center text-sm font-bold text-amber-900">
					<FontAwesomeIcon icon={faTriangleExclamation} class="mr-2 h-4 w-4" />
					안내
				</h2>
				<div class="space-y-1 text-sm text-amber-900">
					{#if hasCacheIssue}
						<p>캐시가 초기화되지 않았습니다. 크롤링/Redis 상태를 확인하세요.</p>
					{/if}
					{#if hasBatchBacklog}
						<p>현재 배치 작업이 진행 중입니다. 서비스 응답이 일시적으로 지연될 수 있습니다.</p>
					{/if}
					{#if hasOllamaIssue}
						<p>
							Ollama 상태가 {ollamaHealthStatus}입니다.
							{#if stats.ollama?.health.error}
								오류: {stats.ollama.health.error}
							{/if}
						</p>
					{/if}
				</div>
			</section>
		{/if}

		<section
			class="mt-4 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm"
		>
			<h2 class="mb-3 flex items-center text-base font-bold text-slate-900">
				<FontAwesomeIcon icon={faBoxArchive} class="mr-2 h-4 w-4 text-indigo-600" />
				최근 배치 작업 이력
				{#if recentJobs.length > 0}
					<span
						class="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-600"
					>
						{recentJobs.length}건
					</span>
				{/if}
			</h2>
			{#if recentJobs.length === 0}
				<p class="text-sm text-slate-500">기록된 배치 작업이 없습니다.</p>
			{:else}
				<p class="mb-2 text-xs text-slate-400 sm:hidden">
					<FontAwesomeIcon icon={faArrowLeft} class="mr-1" />
					좌우로 스크롤하여 전체 내용을 확인할 수 있습니다
					<FontAwesomeIcon icon={faArrowRight} class="ml-1" />
				</p>
				<div class="overflow-x-auto">
					<table class="w-full min-w-140 text-sm">
						<thead>
							<tr class="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
								<th class="pr-4 pb-2">ID</th>
								<th class="pr-4 pb-2">시작 시간</th>
								<th class="pr-4 pb-2">상태</th>
								<th class="pr-4 pb-2 text-right">작업</th>
								<th class="pr-4 pb-2 text-right">성공</th>
								<th class="pr-4 pb-2 text-right">실패</th>
								<th class="pb-2 text-right">소요</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50">
							{#each recentJobs as job (job.id)}
								<tr class="text-slate-700 hover:bg-slate-50/60">
									<td class="py-2 pr-4">
										<span
											class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600"
											title={job.id}
										>
											{job.id.slice(-12)}
										</span>
									</td>
									<td class="py-2 pr-4 text-xs text-slate-500">{formatDateTime(job.startedAt)}</td>
									<td class="py-2 pr-4">
										<span
											class={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${batchStatusStyle(job.status)}`}
										>
											{batchStatusLabel(job.status)}
										</span>
										{#if job.status === 'failed' && job.error}
											<span class="ml-1 text-xs text-red-500" title={job.error}>(!)</span>
										{/if}
									</td>
									<td class="py-2 pr-4 text-right font-semibold">{job.totalJobs}</td>
									<td class="py-2 pr-4 text-right font-semibold text-emerald-600">
										{job.status === 'running' ? '-' : job.successCount}
									</td>
									<td
										class="py-2 pr-4 text-right font-semibold {job.failedCount > 0
											? 'text-red-500'
											: 'text-slate-400'}"
									>
										{job.status === 'running' ? '-' : job.failedCount}
									</td>
									<td class="py-2 text-right text-xs text-slate-500"
										>{formatDuration(job.duration)}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	</main>
</div>
