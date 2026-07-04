<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsRotate,
		faBoxArchive,
		faCloud,
		faClock,
		faDatabase,
		faGear,
		faLink,
		faRobot,
		faSquareCheck,
		faTriangleExclamation,
		faXmarkCircle,
		faArrowLeft,
		faArrowRight
	} from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';
	import type {
		OllamaHealthStatus,
		BatchRunRecord,
		BatchProcessingStats,
		IsDoneSyncStatus
	} from '$lib/types/api';

	export let data: PageData;

	$: stats = data.stats;
	$: fetchedAt = data.fetchedAt;
	$: error = data.error;

	let isRefreshing = false;

	$: isDoneSync = stats.archive.isDoneSync as IsDoneSyncStatus | null | undefined;

	function isDoneSyncBadgeStyle(status: IsDoneSyncStatus['status'] | undefined) {
		switch (status) {
			case 'idle':
				return 'lc-chip-success';
			case 'running':
				return 'lc-chip-blue';
			case 'failed':
				return 'lc-chip-danger';
			default:
				return 'lc-chip-muted';
		}
	}

	function isDoneSyncStatusLabel(status: IsDoneSyncStatus['status'] | undefined) {
		switch (status) {
			case 'idle':
				return '대기';
			case 'running':
				return '실행 중';
			case 'failed':
				return '오류';
			default:
				return '알 수 없음';
		}
	}

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
					badge: 'lc-chip-success',
					icon: faSquareCheck
				};
			case 'degraded':
				return {
					badge: 'lc-chip-warning',
					icon: faTriangleExclamation
				};
			case 'unhealthy':
				return {
					badge: 'lc-chip-danger',
					icon: faXmarkCircle
				};
			case 'misconfigured':
				return {
					badge: 'lc-chip-warning',
					icon: faTriangleExclamation
				};
			case 'disabled':
				return {
					badge: 'lc-chip-muted',
					icon: faCloud
				};
			default:
				return {
					badge: 'lc-chip-muted',
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
				return 'lc-chip-success';
			case 'failed':
				return 'lc-chip-danger';
			case 'running':
				return 'lc-chip-blue';
			default:
				return 'lc-chip-muted';
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

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<div class="lc-panel-hero mb-6 rounded-2xl border p-5">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="lc-text-info text-xs font-semibold tracking-wide">SYSTEM STATUS</p>
					<h1 class="lc-text-primary mt-1 text-2xl font-bold">LawCast 시스템 상태</h1>
					<p class="lc-text-secondary mt-1 text-sm">
						마지막 조회: <span class="lc-text-primary font-semibold"
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
						class="lc-chip-cyan inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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
			<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
				<h2 class="lc-text-primary mb-3 flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faLink} class="lc-text-success mr-2 h-4 w-4" />
					웹훅 상태
				</h2>
				<div class="lc-text-secondary space-y-1 text-sm">
					<p>
						전체: <span class="font-semibold">{stats.webhooks.total.toLocaleString('ko-KR')}개</span
						>
					</p>
					<p>
						활성: <span class="font-semibold"
							>{stats.webhooks.active.toLocaleString('ko-KR')}개</span
						>
					</p>
				</div>
			</section>

			<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
				<h2 class="lc-text-primary mb-3 flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faDatabase} class="lc-text-accent mr-2 h-4 w-4" />
					캐시 상태
				</h2>
				<div class="lc-text-secondary space-y-1 text-sm">
					<p>
						캐시 크기: <span class="font-semibold">{stats.cache.size.toLocaleString('ko-KR')}</span>
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

			<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
				<h2 class="lc-text-primary mb-3 flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faGear} class="lc-text-purple mr-2 h-4 w-4" />
					배치 처리
				</h2>
				<div class="lc-text-secondary space-y-1 text-sm">
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

			<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
				<h2 class="lc-text-primary mb-3 flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faRobot} class="lc-text-info mr-2 h-4 w-4" />
					AI 요약
				</h2>
				<div class="lc-text-secondary space-y-1 text-sm">
					<p>
						사용 여부: <span class="font-semibold"
							>{stats.ollama?.enabled ? '사용 중' : '꺼짐'}</span
						>
					</p>
					<p>모델: <span class="font-semibold">{stats.ollama?.model || 'N/A'}</span></p>
					<p>
						연결 상태:
						<span
							class={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ollamaStyle.badge}`}
						>
							{ollamaHealthStatus}
						</span>
					</p>
					<p>
						마지막 점검: <span class="font-semibold"
							>{formatDateTime(stats.ollama?.health.lastCheckedAt)}</span
						>
					</p>
				</div>
			</section>
		</div>

		{#if hasBatchBacklog || hasCacheIssue || hasOllamaIssue}
			<section class="lc-banner-warning mt-4 rounded-2xl border p-4">
				<h2 class="mb-2 flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faTriangleExclamation} class="mr-2 h-4 w-4" />
					안내
				</h2>
				<div class="space-y-1 text-sm">
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

		<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
			<h2 class="lc-text-primary mb-3 flex items-center text-base font-bold">
				<FontAwesomeIcon icon={faArrowsRotate} class="lc-text-info mr-2 h-4 w-4" />
				종료 마커 동기화
				{#if isDoneSync}
					<span
						class={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isDoneSyncBadgeStyle(isDoneSync.status)}`}
					>
						{isDoneSyncStatusLabel(isDoneSync.status)}
					</span>
				{/if}
			</h2>
			{#if isDoneSync}
				<div class="grid grid-cols-2 gap-3">
					<div class="lc-stat-tile rounded-xl border p-3">
						<p class="lc-text-muted text-xs">수신된 종료 건수</p>
						<p class="lc-text-primary mt-1 text-lg font-bold">
							{(isDoneSync.lastResult?.fetchedDoneCount ?? 0).toLocaleString('ko-KR')}
						</p>
					</div>
					<div class="lc-stat-tile rounded-xl border p-3">
						<p class="lc-text-muted text-xs">신규 마킹</p>
						<p class="lc-text-primary mt-1 text-lg font-bold">
							{(isDoneSync.lastResult?.markedDoneCount ?? 0).toLocaleString('ko-KR')}
						</p>
					</div>
				</div>
				<ul class="lc-text-secondary mt-3 space-y-1.5 text-sm">
					<li class="lc-stat-tile flex items-center justify-between rounded-lg border px-3 py-2">
						<span>마지막 실행</span>
						<span class="font-semibold">{formatDateTime(isDoneSync.lastRunAt)}</span>
					</li>
					{#if isDoneSync.status === 'failed' && isDoneSync.lastError}
						<li class="lc-banner-error-soft rounded-lg border px-3 py-2">
							<span class="font-semibold">오류: </span>{isDoneSync.lastError}
						</li>
					{/if}
				</ul>
			{:else}
				<p class="lc-text-muted text-sm">동기화 이력이 없습니다. (서버 재시작 후 자동 실행)</p>
			{/if}
		</section>

		<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
			<h2 class="lc-text-primary mb-3 flex items-center text-base font-bold">
				<FontAwesomeIcon icon={faBoxArchive} class="lc-text-purple mr-2 h-4 w-4" />
				최근 배치 작업 이력
				{#if recentJobs.length > 0}
					<span class="lc-chip-purple ml-2 rounded-full px-2 py-0.5 text-xs font-semibold">
						{recentJobs.length}건
					</span>
				{/if}
			</h2>
			{#if recentJobs.length === 0}
				<p class="lc-text-muted text-sm">기록된 배치 작업이 없습니다.</p>
			{:else}
				<p class="lc-text-dim mb-2 text-xs sm:hidden">
					<FontAwesomeIcon icon={faArrowLeft} class="mr-1" />
					좌우로 스크롤하여 전체 내용을 확인할 수 있습니다
					<FontAwesomeIcon icon={faArrowRight} class="ml-1" />
				</p>
				<div class="overflow-x-auto">
					<table class="w-full min-w-140 text-sm">
						<thead>
							<tr
								class="lc-text-muted border-b border-(--lc-border-soft) text-left text-xs font-semibold"
							>
								<th class="pr-4 pb-2">ID</th>
								<th class="pr-4 pb-2">시작 시간</th>
								<th class="pr-4 pb-2">상태</th>
								<th class="pr-4 pb-2 text-right">작업</th>
								<th class="pr-4 pb-2 text-right">성공</th>
								<th class="pr-4 pb-2 text-right">실패</th>
								<th class="pb-2 text-right">소요</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-(--lc-border-soft)">
							{#each recentJobs as job (job.id)}
								<tr class="lc-table-row lc-text-secondary">
									<td class="py-2 pr-4">
										<span
											class="lc-chip-muted rounded px-1.5 py-0.5 font-mono text-xs"
											title={job.id}
										>
											{job.id.slice(-12)}
										</span>
									</td>
									<td class="lc-text-muted py-2 pr-4 text-xs">{formatDateTime(job.startedAt)}</td>
									<td class="py-2 pr-4">
										<span
											class={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${batchStatusStyle(job.status)}`}
										>
											{batchStatusLabel(job.status)}
										</span>
										{#if job.status === 'failed' && job.error}
											<span class="lc-text-danger ml-1 text-xs" title={job.error}>(!)</span>
										{/if}
									</td>
									<td class="py-2 pr-4 text-right font-semibold">{job.totalJobs}</td>
									<td class="lc-text-success py-2 pr-4 text-right font-semibold">
										{job.status === 'running' ? '-' : job.successCount}
									</td>
									<td
										class="py-2 pr-4 text-right font-semibold {job.failedCount > 0
											? 'lc-text-danger'
											: 'lc-text-dim'}"
									>
										{job.status === 'running' ? '-' : job.failedCount}
									</td>
									<td class="lc-text-muted py-2 text-right text-xs"
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
