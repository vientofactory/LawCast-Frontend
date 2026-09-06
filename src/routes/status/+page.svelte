<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsRotate,
		faCloud,
		faClock,
		faDatabase,
		faLink,
		faRobot,
		faSquareCheck,
		faTriangleExclamation,
		faXmarkCircle,
		faGlobe
	} from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';
	import type { OllamaHealthStatus, IsDoneSyncStatus, CrawlerStatus } from '$lib/types/api';
	import { formatDateTimeKST } from '$lib/utils/helpers';

	export let data: PageData;

	$: stats = data.stats as import('$lib/types/api').SystemStats;
	$: fetchedAt = data.fetchedAt;
	$: error = data.error;

	let isRefreshing = false;
	let lastRefreshAt = 0;
	let lastTimerRefreshAt = 0;
	const REFRESH_COOLDOWN_MS = 30_000;
	const TIMER_REFRESH_COOLDOWN_MS = 20_000;

	$: crawlers = stats.crawlers;
	$: isDoneSync = stats.archive.isDoneSync as IsDoneSyncStatus | null | undefined;

	// ── Optimistic countdown timer ──────────────────────────────────────
	// Server-provided timestamps are the source of truth. A client-side
	// tick updates the countdown every second without hitting the server.
	// Auto-refreshes when the data becomes stale or a timer exhausts.
	let tickInterval: ReturnType<typeof setInterval> | null = null;
	const STALE_THRESHOLD_MS = 15_000;

	// Writable store guarantees reactivity even in legacy mode.
	// The $ prefix auto-subscribes in the template.
	const now = writable(Date.now());

	function calcRemaining(lastRunAt: string | null, intervalMs: number, currentNow: number): number {
		if (!lastRunAt || intervalMs <= 0) return -1;
		return Math.max(0, intervalMs - (currentNow - new Date(lastRunAt).getTime()));
	}

	let palRemaining = 0;
	let nsmRemaining = 0;

	// Update countdowns every tick by subscribing to the store
	const unsubNow = now.subscribe((t) => {
		palRemaining = crawlers
			? calcRemaining(crawlers.palCrawler.lastRunAt, crawlers.palCrawler.cron.intervalMs, t)
			: -1;
		nsmRemaining = crawlers
			? calcRemaining(
					crawlers.nsmPendingCrawler.lastRunAt,
					crawlers.nsmPendingCrawler.cron.intervalMs,
					t
				)
			: -1;
	});

	function fmtRemaining(ms: number): string {
		if (ms < 0) return '-';
		if (ms <= 0) return '곧 실행';
		const min = Math.floor(ms / 60_000);
		const sec = Math.floor((ms % 60_000) / 1000);
		return min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
	}

	function formatDateTime(value: string | null | undefined): string {
		return formatDateTimeKST(value);
	}

	$: palCountdown = crawlers ? countdownLabel(palRemaining, crawlers.palCrawler.status) : '-';
	$: nsmCountdown = crawlers
		? countdownLabel(nsmRemaining, crawlers.nsmPendingCrawler.status)
		: '-';

	/**
	 * States:
	 *  - running  -> always "수집 중…" (server is actively crawling)
	 *  - idle     -> countdown string or "대기 중" when timer expired
	 *  - failed   -> countdown string or "대기 중" when timer expired
	 */
	function countdownLabel(remainingMs: number, status: CrawlerStatus['status']): string {
		if (status === 'running') return '수집 중…';
		if (remainingMs > 0) return fmtRemaining(remainingMs);
		if (status === 'failed') return '대기 중';
		// idle + timer expired -> cron is about to fire or just fired
		return '곧 실행';
	}

	function startTick() {
		if (tickInterval) return;
		tickInterval = setInterval(() => {
			now.set(Date.now());

			// ── Staleness refresh ─────────────────────────────────────
			const t = Date.now();
			if (fetchedAt && t - new Date(fetchedAt).getTime() > STALE_THRESHOLD_MS) {
				refreshStatus();
			}

			// ── Timer-exhausted refresh ───────────────────────────────
			// When a cron timer expires, refresh to pick up the server's
			// new lastRunAt — but with a short cooldown to avoid hammering
			// the server while the cron hasn't fired yet.
			if (crawlers) {
				if (
					(palRemaining <= 0 && crawlers.palCrawler.status !== 'running') ||
					(nsmRemaining <= 0 && crawlers.nsmPendingCrawler.status !== 'running')
				) {
					const sinceLastTimerRefresh = t - lastTimerRefreshAt;
					if (sinceLastTimerRefresh >= TIMER_REFRESH_COOLDOWN_MS) {
						lastTimerRefreshAt = t;
						refreshStatus(true);
					}
				}
			}
		}, 1_000);
	}

	function stopTick() {
		if (tickInterval) {
			clearInterval(tickInterval);
			tickInterval = null;
		}
	}

	function handleVisibilityChange() {
		if (!browser) return;
		if (document.hidden) {
			stopTick();
		} else {
			now.set(Date.now());
			startTick();
		}
	}

	onMount(() => {
		if (!browser) return;
		startTick();
		document.addEventListener('visibilitychange', handleVisibilityChange);
	});

	onDestroy(() => {
		if (!browser) return;
		stopTick();
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		unsubNow();
	});

	function crawlerStatusBadge(status: CrawlerStatus['status']) {
		switch (status) {
			case 'running':
				return { badge: 'lc-chip-success', label: '실행 중', icon: faArrowsRotate };
			case 'failed':
				return { badge: 'lc-chip-danger', label: '오류', icon: faXmarkCircle };
			default:
				return { badge: 'lc-chip-blue', label: '대기', icon: faSquareCheck };
		}
	}

	$: palBadge = crawlers ? crawlerStatusBadge(crawlers.palCrawler.status) : null;
	$: nsmBadge = crawlers ? crawlerStatusBadge(crawlers.nsmPendingCrawler.status) : null;

	const CRON_JOB_NAME_MAP: Record<string, string> = {
		'crawling and notification': '국회 입법예고 크롤링 및 알림',
		'pending bills crawl (NsmLmSts)': '국민참여입법센터 신규 의안 수집',
		'proposalReason backfill drain': '입법취지 백필 드레인',
		'isDone sync': '입법예고 종료 마커 동기화',
		'webhook cleanup': '웹훅 정리',
		'webhook optimization': '웹훅 최적화',
		'system monitoring': '시스템 모니터링',
		'snapshot artifact backfill': '스냅샷 아티팩트 백필',
		'integrity re-scan': '아카이브 무결성 재검증',
		'change-tracking daily audit': '변경 이력 일일 감사',
		'change-tracking weekly audit': '변경 이력 주간 감사',
		'quick keyword refresh': '빠른 키워드 갱신',
		'sqlite vacuum': 'SQLite 정리',
		'database mirror upload': 'DB 미러 업로드',
		'discussion idle close': '비활성 토론 스레드 정리'
	};

	function formatCronJobName(name: string): string {
		return CRON_JOB_NAME_MAP[name] ?? name;
	}

	function cronJobStatusBadge(status: string) {
		switch (status) {
			case 'running':
				return 'lc-chip-blue';
			case 'failed':
				return 'lc-chip-danger';
			default:
				return 'lc-chip-muted';
		}
	}

	function cronJobStatusLabel(status: string): string {
		switch (status) {
			case 'running':
				return '실행 중';
			case 'failed':
				return '실패';
			default:
				return '대기';
		}
	}

	$: ollamaHealthStatus = (stats.ollama?.health.status ?? 'unknown') as OllamaHealthStatus;
	$: hasOllamaIssue = ollamaHealthStatus === 'unhealthy' || ollamaHealthStatus === 'misconfigured';
	$: hasCacheIssue = stats.cache.isInitialized === false;
	$: hasCrawlerFailure =
		crawlers?.palCrawler.status === 'failed' ||
		crawlers?.nsmPendingCrawler.status === 'failed' ||
		(crawlers?.cronJobs.some((j) => j.status === 'failed') ?? false);

	$: overallStatus = (
		hasOllamaIssue || hasCacheIssue || hasCrawlerFailure ? 'degraded' : 'healthy'
	) as 'healthy' | 'degraded';
	$: overallLabel = overallStatus === 'healthy' ? '정상' : '주의 필요';

	function isDoneSyncBadgeStyle(status: IsDoneSyncStatus['status'] | undefined) {
		switch (status) {
			case 'idle':
				return 'lc-chip-blue';
			case 'running':
				return 'lc-chip-success';
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

	$: overallStyle = (() => {
		switch (overallStatus) {
			case 'healthy':
				return { badge: 'lc-chip-success', icon: faSquareCheck };
			case 'degraded':
				return { badge: 'lc-chip-warning', icon: faTriangleExclamation };
			default:
				return { badge: 'lc-chip-muted', icon: faClock };
		}
	})();
	$: ollamaStyle = (() => {
		switch (ollamaHealthStatus) {
			case 'healthy':
				return { badge: 'lc-chip-success', icon: faSquareCheck };
			case 'unhealthy':
				return { badge: 'lc-chip-danger', icon: faXmarkCircle };
			case 'misconfigured':
				return { badge: 'lc-chip-warning', icon: faTriangleExclamation };
			default:
				return { badge: 'lc-chip-muted', icon: faClock };
		}
	})();

	async function refreshStatus(manual = false) {
		if (isRefreshing) return;
		if (!manual) {
			const elapsed = Date.now() - lastRefreshAt;
			if (elapsed < REFRESH_COOLDOWN_MS) return;
		}
		isRefreshing = true;
		try {
			await invalidateAll();
		} finally {
			lastRefreshAt = Date.now();
			isRefreshing = false;
			// Sync now so the countdown recalculates with the fresh lastRunAt
			// from the server. Without this, palRemaining/nsmRemaining keep
			// using the old lastRunAt until the next 1-second tick.
			now.set(Date.now());
		}
	}
</script>

<svelte:head>
	<title>LawCast - 시스템 상태</title>
	<meta
		name="description"
		content="LawCast 시스템 상태 대시보드입니다. 크롤러, 캐시, AI 요약 상태를 확인할 수 있습니다."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="LawCast - 시스템 상태" />
	<meta
		property="og:description"
		content="LawCast 시스템 상태 대시보드입니다. 크롤러, 캐시, AI 요약 상태를 확인할 수 있습니다."
	/>
	<meta name="twitter:title" content="LawCast - 시스템 상태" />
	<meta
		name="twitter:description"
		content="LawCast 시스템 상태 대시보드입니다. 크롤러, 캐시, AI 요약 상태를 확인할 수 있습니다."
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
						on:click={() => refreshStatus(true)}
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

		{#if hasCacheIssue || hasOllamaIssue}
			<section class="lc-banner-warning lc-defer-render-sm mt-4 mb-4 rounded-2xl border p-4">
				<h2 class="mb-2 flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faTriangleExclamation} class="mr-2 h-4 w-4" />
					안내
				</h2>
				<div class="space-y-1 text-sm">
					{#if hasCacheIssue}
						<p>캐시가 초기화되지 않았습니다. 크롤링/Redis 상태를 확인하세요.</p>
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

		<!-- ── Crawler Status Cards ─────────────────────────────────────── -->
		{#if crawlers}
			<div class="grid gap-4 md:grid-cols-2">
				<!-- PAL Crawler -->
				<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="lc-text-primary flex items-center text-sm font-bold">
							<FontAwesomeIcon icon={faGlobe} class="lc-text-accent mr-2 h-4 w-4" />
							국회 입법예고 크롤러
						</h3>
						<span
							class={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${palBadge?.badge ?? ''}`}
						>
							{#key crawlers.palCrawler.status}
								<FontAwesomeIcon icon={palBadge?.icon ?? faClock} class="h-3 w-3" />
							{/key}
							{palBadge?.label ?? '대기'}
						</span>
					</div>
					<div class="lc-text-secondary space-y-1.5 text-sm">
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">소스</span>
							<span class="font-semibold">{crawlers.palCrawler.source}</span>
						</p>
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">스케줄</span>
							<span class="font-mono text-xs">{crawlers.palCrawler.cron.description}</span>
						</p>
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">마지막 실행</span>
							<span class="font-semibold">{formatDateTime(crawlers.palCrawler.lastRunAt)}</span>
						</p>
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">다음 실행까지</span>
							<span class="lc-text-accent font-semibold">
								{palCountdown}
							</span>
						</p>
						{#if crawlers.palCrawler.lastError}
							<p class="lc-text-danger mt-1 rounded bg-red-500/5 px-2 py-1 text-xs">
								오류: {crawlers.palCrawler.lastError.slice(0, 80)}
							</p>
						{/if}
					</div>
				</section>

				<!-- NSM Crawler -->
				<section class="lc-panel-card rounded-2xl border p-4 shadow-sm">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="lc-text-primary flex items-center text-sm font-bold">
							<FontAwesomeIcon icon={faGlobe} class="lc-text-purple mr-2 h-4 w-4" />
							국민참여입법센터 크롤러
						</h3>
						<span
							class={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${nsmBadge?.badge ?? ''}`}
						>
							{#key crawlers.nsmPendingCrawler.status}
								<FontAwesomeIcon icon={nsmBadge?.icon ?? faClock} class="h-3 w-3" />
							{/key}
							{nsmBadge?.label ?? '대기'}
						</span>
					</div>
					<div class="lc-text-secondary space-y-1.5 text-sm">
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">소스</span>
							<span class="font-semibold">{crawlers.nsmPendingCrawler.source}</span>
						</p>
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">스케줄</span>
							<span class="font-mono text-xs">{crawlers.nsmPendingCrawler.cron.description}</span>
						</p>
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">마지막 실행</span>
							<span class="font-semibold"
								>{formatDateTime(crawlers.nsmPendingCrawler.lastRunAt)}</span
							>
						</p>
						<p class="flex items-center justify-between">
							<span class="lc-text-muted">다음 실행까지</span>
							<span class="lc-text-accent font-semibold">
								{nsmCountdown}
							</span>
						</p>
						{#if crawlers.nsmPendingCrawler.lastError}
							<p class="lc-text-danger mt-1 rounded bg-red-500/5 px-2 py-1 text-xs">
								오류: {crawlers.nsmPendingCrawler.lastError.slice(0, 80)}
							</p>
						{/if}
					</div>
				</section>
			</div>

			<!-- ── Cron Job Status ──────────────────────────────────────── -->
			<section class="lc-panel-card lc-defer-render-sm mt-4 rounded-2xl border p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="lc-text-primary flex items-center text-sm font-bold">
						<FontAwesomeIcon icon={faArrowsRotate} class="lc-text-info mr-2 h-4 w-4" />
						크론 작업 현황
					</h2>
				</div>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each crawlers.cronJobs as job (job.name)}
						<div class="rounded-xl border border-(--lc-border-soft) px-3 py-2">
							<div class="mb-1 flex items-center justify-between">
								<span class="lc-text-primary text-xs font-semibold"
									>{formatCronJobName(job.name)}</span
								>
								<span
									class={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cronJobStatusBadge(job.status)}`}
								>
									{cronJobStatusLabel(job.status)}
								</span>
							</div>
							<div class="lc-text-dim text-[11px] font-mono">
								{job.cron.description}
							</div>
							<div class="lc-text-dim text-[11px]">
								마지막: {formatDateTime(job.lastRunAt)}
							</div>
							{#if job.lastError}
								<div class="lc-text-danger mt-0.5 truncate text-[11px]" title={job.lastError ?? ''}>
									{job.lastError?.slice(0, 60)}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- ── Core Status Cards ───────────────────────────────────────── -->
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-4">
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
					<FontAwesomeIcon icon={faCloud} class="lc-text-info mr-2 h-4 w-4" />
					웹 푸시 상태
				</h2>
				<div class="lc-text-secondary space-y-1 text-sm">
					<p>
						전체 구독:
						<span class="font-semibold"
							>{(stats.webPush?.total ?? 0).toLocaleString('ko-KR')}개</span
						>
					</p>
					<p>
						활성 구독:
						<span class="font-semibold"
							>{(stats.webPush?.active ?? 0).toLocaleString('ko-KR')}개</span
						>
					</p>
					<p>
						실패 이력:
						<span
							class={`font-semibold ${(stats.webPush?.withFailures ?? 0) > 0 ? 'lc-text-dim' : ''}`}
							>{(stats.webPush?.withFailures ?? 0).toLocaleString('ko-KR')}개</span
						>
					</p>
					<p class="lc-text-dim text-xs">자동 정리 대상 포함</p>
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

			<section class="lc-panel-card lc-defer-render-sm rounded-2xl border p-5 shadow-sm">
				<h2 class="lc-text-primary mb-3 flex items-center text-sm font-bold">
					<FontAwesomeIcon icon={faArrowsRotate} class="lc-text-info mr-2 h-4 w-4" />
					종료 마커 동기화
				</h2>
				<div class="lc-text-secondary space-y-1 text-sm">
					{#if isDoneSync}
						<p>
							상태: <span
								class={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isDoneSyncBadgeStyle(isDoneSync.status)}`}
							>
								{isDoneSyncStatusLabel(isDoneSync.status)}
							</span>
						</p>
						<p>
							수신된 종료 건수: <span class="font-semibold"
								>{(isDoneSync.lastResult?.fetchedDoneCount ?? 0).toLocaleString('ko-KR')}</span
							>
						</p>
						<p>
							신규 마킹: <span class="font-semibold"
								>{(isDoneSync.lastResult?.markedDoneCount ?? 0).toLocaleString('ko-KR')}</span
							>
						</p>
						<p>
							마지막 실행: <span class="font-semibold">{formatDateTime(isDoneSync.lastRunAt)}</span>
						</p>
						{#if isDoneSync.status === 'failed' && isDoneSync.lastError}
							<p class="lc-text-danger">
								오류: <span class="font-semibold">{isDoneSync.lastError}</span>
							</p>
						{/if}
					{:else}
						<p class="lc-text-muted text-sm">동기화 이력이 없습니다. (서버 재시작 후 자동 실행)</p>
					{/if}
				</div>
			</section>
		</div>
	</main>
</div>
