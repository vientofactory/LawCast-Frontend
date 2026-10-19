<script lang="ts">
	import { onDestroy } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import PaginationNav from '$lib/components/PaginationNav.svelte';
	import RateLimitOverlay from '$lib/components/RateLimitOverlay.svelte';
	import { openExternalLink, downloadFile, isDownloadable } from '$lib/utils/helpers';
	import { extractProposerFromSubject } from '$lib/utils/proposer';
	import { buildNoticeDeadline } from '$lib/utils/notice-deadline.util';
	import { RetryCountdown } from '$lib/utils/retry-countdown.util';
	import { apiClient } from '$lib/api/client';
	import { page } from '$app/state';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { env } from '$env/dynamic/public';
	import {
		BOARD_RELEVANCE_HINTS,
		BOARD_SEARCH_MODE_HINTS,
		BOARD_SEARCH_MODE_LABELS,
		BOARD_SEARCH_MODES,
		buildSemanticSearchHref,
		describeWeakProgress,
		describeWeakReveal,
		formatSectionLabel,
		formatSimilarityPercent,
		isSemanticSearchEnabled,
		normalizeBoardSearchMode,
		WEAK_RESULT_PAGE_SIZE
	} from '$lib/utils/semantic-search';
	import { afterNavigate, beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { SvelteDate, SvelteURLSearchParams } from 'svelte/reactivity';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBell,
		faCalendar,
		faExternalLink,
		faFileDownload,
		faFileText,
		faLock,
		faMagnifyingGlass,
		faRotate,
		faSpinner,
		faTriangleExclamation,
		faUser,
		faWandMagicSparkles,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import type { ArchiveNoticeCardListResponse, BoardSearchMode } from '$lib/types/api';
	import { KST_TIMEZONE } from '$lib/utils/helpers';

	let {
		data
	}: {
		data: {
			archive: ArchiveNoticeCardListResponse;
			/** Everyday-language example queries from the loader (flag-gated). */
			exampleQueries?: string[];
			digestContext?: {
				isDigestContext: boolean;
				noticeNums: number[];
			};
			loadError?: {
				message: string;
				retryAfter?: number;
			};
		};
	} = $props();

	const SEMANTIC_SEARCH_ENABLED = isSemanticSearchEnabled(env.PUBLIC_SEMANTIC_SEARCH_ENABLED);

	// Reactive URL snapshot: $derived filters (isDoneFilter, searchMode, ...) must
	// recompute when afterNavigate reassigns it after client-side navigation.
	let currentUrl = $state(page.url);
	let isServerLoading = $state(false);
	let countdown = $state(0);
	let isRetrying = $state(false);
	const retry = new RetryCountdown(
		() => invalidateAll(),
		(v) => {
			countdown = v;
		},
		(v) => {
			isRetrying = v;
		}
	);
	onDestroy(() => retry.destroy());

	$effect(() => {
		if (data.loadError !== retry.lastSeenError) {
			retry.lastSeenError = data.loadError;
			if (data.loadError?.retryAfter && data.loadError.retryAfter > 0) {
				retry.start(data.loadError.retryAfter);
			} else {
				retry.stop();
			}
		}
	});

	beforeNavigate(({ to }) => {
		isServerLoading = !!to?.url && to.url.pathname.replace(/\/+$/, '') === '/notices';
	});

	afterNavigate(() => {
		currentUrl = page.url;
		isServerLoading = false;
	});

	const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
	const DEFAULT_PAGE_SIZE = 20;

	let archive = $derived(data.archive);
	let notices = $derived(archive?.items || []);
	let currentPage = $derived(archive?.page || 1);
	let totalPages = $derived(archive?.totalPages || 1);
	let totalItems = $derived(archive?.total || 0);
	let limit = $derived(archive?.limit || DEFAULT_PAGE_SIZE);
	let searchQuery = $derived(archive?.search || '');
	let proposerQuery = $derived(archive?.proposer || '');
	let startDate = $derived(archive?.startDate || '');
	let endDate = $derived(archive?.endDate || '');
	// Annotated: a mutable `let` widens the literal union to `string`, which then no
	// longer matches the API client's `'asc' | 'desc'` parameter.
	let sortOrder: 'asc' | 'desc' = $derived(archive?.sortOrder === 'asc' ? 'asc' : 'desc');
	let isDoneFilter = $derived(
		(() => {
			const v = currentUrl.searchParams.get('isDone');
			return v === 'true' ? true : v === 'false' ? false : undefined;
		})()
	);
	// Board search mode, flag-gated: default `auto` (semantic-first) when the
	// feature is on, plain `keyword` otherwise. Mirrors the loader's normalization
	// (`normalizeBoardSearchMode`). URLs with no param fall back to that default.
	let searchMode = $derived(
		SEMANTIC_SEARCH_ENABLED
			? normalizeBoardSearchMode(currentUrl.searchParams.get('searchMode'), true)
			: 'keyword'
	);
	// Semantic metadata the API echoed back: null in pure keyword mode.
	let boardSemantic = $derived(archive?.semantic ?? null);
	let weakResults = $derived(boardSemantic?.weakResults ?? []);
	// The weak-tier reveal is pinned to the exact response payload so a new search
	// starts hidden again without an $effect. $state.raw keeps identity comparison
	// honest ($state would proxy the payload and never match) — see frontend-notes.
	let revealedArchive = $state.raw<ArchiveNoticeCardListResponse | null>(null);
	let showingWeak = $derived(
		archive !== null &&
			revealedArchive === archive &&
			notices.length === 0 &&
			weakResults.length > 0
	);
	// The weak tier is the engine's below-threshold pool (up to 100 hits on this
	// board), so it pages in batches instead of rendering the whole pool at once.
	let weakVisible = $state(WEAK_RESULT_PAGE_SIZE);
	let weakVisibleResults = $derived(weakResults.slice(0, weakVisible));
	let hasMoreWeak = $derived(weakVisible < weakResults.length);

	function revealWeakResults() {
		revealedArchive = archive;
		weakVisible = WEAK_RESULT_PAGE_SIZE;
	}

	function hideWeakResults() {
		revealedArchive = null;
		weakVisible = WEAK_RESULT_PAGE_SIZE;
	}

	function showMoreWeakResults() {
		weakVisible += WEAK_RESULT_PAGE_SIZE;
	}
	// Coverage check for readers who need the exhaustive list (`법조인`, legal
	// professionals): semantic mode ranks a bounded candidate set, so offer the
	// keyword match count under the same
	// filters. Fetched only when asked — one request, never on every search.
	let keywordCountFor = $state<string | null>(null);
	let keywordCountValue = $state<number | null>(null);
	let keywordCountFailed = $state(false);
	let filterSignature = $derived(
		[searchQuery, proposerQuery, startDate, endDate, sortOrder, String(isDoneFilter)].join('|')
	);
	// A stored count is only fresh while the filters it was fetched for still apply,
	// so changing the query or a filter can never display a stale number.
	let keywordCountFresh = $derived(keywordCountFor === filterSignature);
	let keywordCount = $derived(keywordCountFresh ? keywordCountValue : null);
	let keywordCountState = $derived(
		!keywordCountFresh
			? 'idle'
			: keywordCountFailed
				? 'error'
				: keywordCountValue === null
					? 'loading'
					: 'ready'
	);

	/**
	 * Fetch how many notices the keyword path matches under the current filters.
	 * Result is keyed by `filterSignature` so a later search drops it back to idle.
	 */
	async function loadKeywordCount() {
		keywordCountFor = filterSignature;
		keywordCountValue = null;
		keywordCountFailed = false;

		try {
			const response = await apiClient.getArchivedNotices({
				page: 1,
				limit: 1,
				search: searchQuery,
				proposer: proposerQuery,
				startDate,
				endDate,
				sortOrder,
				isDone: isDoneFilter,
				searchMode: 'keyword'
			});
			keywordCountValue = response.total;
		} catch (error) {
			console.error('Failed to count keyword matches:', error);
			keywordCountFailed = true;
		}
	}
	let digestContext = $derived(data.digestContext);
	let isDigestContext = $derived(digestContext?.isDigestContext === true);
	let digestNoticeNums = $derived(digestContext?.noticeNums ?? []);
	let aiSummaryEnabled = $derived(archive?.aiSummaryEnabled !== false);
	let hasActiveFilters = $derived(
		searchQuery.trim().length > 0 ||
			proposerQuery.trim().length > 0 ||
			startDate.trim().length > 0 ||
			endDate.trim().length > 0 ||
			isDoneFilter !== undefined
	);
	let archiveCount = $derived(
		archive?.stats?.totalArchiveCount ?? archive?.stats?.archiveCount ?? 0
	);
	// Filters other than the text query: these can empty the result list on their
	// own, so the empty state offers to clear them before the reader has to guess.
	let hasNonKeywordFilters = $derived(
		proposerQuery.trim().length > 0 ||
			startDate.trim().length > 0 ||
			endDate.trim().length > 0 ||
			isDoneFilter !== undefined
	);
	// Example queries come from the loader (flag-gated); see +page.server.ts.
	let exampleQueries = $derived(data.exampleQueries ?? []);

	let canonicalUrl = $derived(
		(() => {
			const base = currentUrl.origin + currentUrl.pathname;
			if (!hasActiveFilters && currentPage > 1) {
				return `${base}?page=${currentPage}&limit=${limit}&sortOrder=${sortOrder}`;
			}
			return base;
		})()
	);

	let basePageDescription = $derived(
		aiSummaryEnabled
			? '입법예고 아카이브에서 키워드 검색과 법률안을 조회하고, 원문과 AI 요약을 확인할 수 있습니다.'
			: '입법예고 아카이브에서 키워드 검색과 법률안을 조회하고 원문을 확인할 수 있습니다.'
	);
	let basePageKeywords = $derived(
		aiSummaryEnabled
			? '전체 입법예고, 국회 법률안 목록, 법안 원문 조회, 제안이유 및 주요내용, AI 요약, 입법예고 아카이브, 법안 검색, 국회 입법예고 알림'
			: '전체 입법예고, 국회 법률안 목록, 법안 원문 조회, 제안이유 및 주요내용, 입법예고 아카이브, 법안 검색, 국회 입법예고 알림'
	);
	// A search result view is shared and indexed under the query itself, so the
	// active keyword feeds the title, description and keywords together instead
	// of the generic archive copy.
	let activeSearch = $derived(searchQuery.trim());
	// Share metadata must quote the matched result count, never `archiveCount`.
	// The keyword path reports `stats.totalArchiveCount` = matched total, but the
	// semantic path reports the WHOLE archive there (21,188 on production data vs
	// 39 matches for "국민"), which would make the title/description claim ~500x the
	// results. `totalItems` is the matched count in both paths.
	let resultCount = $derived(totalItems);
	let countLabel = $derived(
		resultCount > 0 ? ` (전체 ${resultCount.toLocaleString('ko-KR')}건)` : ''
	);
	let pageTitle = $derived(
		isDigestContext
			? '신규 감지 항목 모아보기'
			: `전체 입법예고${activeSearch ? ` "${activeSearch}" 검색 결과` : ''}${countLabel}`
	);
	let pageDescription = $derived(
		activeSearch
			? `"${activeSearch}" 검색 결과 ${resultCount.toLocaleString('ko-KR')}건의 입법예고입니다. 제안이유와 주요내용${aiSummaryEnabled ? ', AI 요약,' : ''} 원문을 확인할 수 있습니다.`
			: basePageDescription
	);
	let pageKeywords = $derived(
		activeSearch ? `${basePageKeywords}, ${activeSearch}` : basePageKeywords
	);

	function addDays(base: Date, amount: number) {
		const dayMillis = 24 * 60 * 60 * 1000;
		return new SvelteDate(base.getTime() + amount * dayMillis);
	}

	function getKstDateParts(base: Date) {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: KST_TIMEZONE,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});

		const parts = formatter.formatToParts(base);
		const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
		const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
		const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01');

		return { year, month, day };
	}

	function toKstInputDate(base: Date) {
		const { year, month, day } = getKstDateParts(base);
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	const today = new SvelteDate();
	const todayInputDate = toKstInputDate(today);
	const quickStart7Days = toKstInputDate(addDays(today, -6));
	const quickStart30Days = toKstInputDate(addDays(today, -29));
	const kstTodayParts = getKstDateParts(today);
	const quickMonthStart = `${kstTodayParts.year}-${String(kstTodayParts.month).padStart(2, '0')}-01`;
	let isQuick7DaysActive = $derived(startDate === quickStart7Days && endDate === todayInputDate);
	let isQuick30DaysActive = $derived(startDate === quickStart30Days && endDate === todayInputDate);
	let isQuickThisMonthActive = $derived(
		startDate === quickMonthStart && endDate === todayInputDate
	);
	let isQuickClearRangeActive = $derived(!startDate.trim() && !endDate.trim());
	let hasDateReversed = $derived(
		startDate.trim().length > 0 && endDate.trim().length > 0 && startDate > endDate
	);
	let pendingPaginationPage: number | null = $state(null);
	let wasServerLoading = $state(false);

	$effect(() => {
		if (wasServerLoading && !isServerLoading) {
			pendingPaginationPage = null;
		}

		wasServerLoading = isServerLoading;
	});

	type QueryLinkOverrides = {
		page?: number;
		limit?: number;
		search?: string;
		proposer?: string;
		startDate?: string;
		endDate?: string;
		sortOrder?: 'asc' | 'desc';
		isDone?: boolean | null;
		searchMode?: BoardSearchMode;
	};

	function buildQueryLink(overrides: QueryLinkOverrides = {}) {
		const pg = overrides.page !== undefined ? overrides.page : currentPage;
		const lim = overrides.limit !== undefined ? overrides.limit : limit;
		const q = (overrides.search !== undefined ? overrides.search : searchQuery).trim();
		const pr = (overrides.proposer !== undefined ? overrides.proposer : proposerQuery).trim();
		const sd = (overrides.startDate !== undefined ? overrides.startDate : startDate).trim();
		const ed = (overrides.endDate !== undefined ? overrides.endDate : endDate).trim();
		const so = overrides.sortOrder !== undefined ? overrides.sortOrder : sortOrder;
		const id = 'isDone' in overrides ? overrides.isDone : isDoneFilter;
		const sm = overrides.searchMode !== undefined ? overrides.searchMode : searchMode;

		const params = new SvelteURLSearchParams(currentUrl.searchParams);
		params.set('page', String(pg));
		params.set('limit', String(lim));
		if (q) params.set('search', q);
		else params.delete('search');
		if (pr) params.set('proposer', pr);
		else params.delete('proposer');
		if (sd) params.set('startDate', sd);
		else params.delete('startDate');
		if (ed) params.set('endDate', ed);
		else params.delete('endDate');
		params.set('sortOrder', so);
		if (id !== null && id !== undefined) params.set('isDone', String(id));
		else params.delete('isDone');
		// Leftover `fullText` params from old bookmarks/crawled links are dropped:
		// proposal-reason search is the default now, so the flag has no meaning.
		params.delete('fullText');
		// Write the mode explicitly (including 'keyword'): an absent param would
		// re-resolve to the flag default ('auto'), so deletion could not express
		// an explicit keyword choice. With the flag off the param stays out.
		if (SEMANTIC_SEARCH_ENABLED) params.set('searchMode', sm);
		else params.delete('searchMode');

		// Keep digest context normalized when present.
		const digestRaw = params.get('digest');
		if (digestRaw === 'true') {
			params.set('digest', '1');
		}
		return `/notices?${params.toString()}`;
	}

	let buildFilterLink = $derived(
		(
			(_id: boolean | undefined) =>
			(overrides: {
				search?: string;
				proposer?: string;
				startDate?: string;
				endDate?: string;
				sortOrder?: 'asc' | 'desc';
				isDone?: boolean | null;
				searchMode?: BoardSearchMode;
			}) =>
				buildQueryLink({ page: 1, ...overrides })
		)(isDoneFilter)
	);

	let buildPageLink = $derived(
		(
			(_id: boolean | undefined) => (pg: number) =>
				buildQueryLink({ page: pg })
		)(isDoneFilter)
	);

	function shouldShowAIBriefing(notice: (typeof notices)[number]) {
		if (!aiSummaryEnabled) {
			return false;
		}

		return notice.aiSummaryStatus === 'ready' || notice.aiSummaryStatus === 'unavailable';
	}

	function isSourceDeleted(notice: (typeof notices)[number]): boolean {
		return notice.lifecycleStatus === 'source_deleted';
	}

	function isRenumbered(notice: (typeof notices)[number]): boolean {
		return notice.lifecycleStatus === 'renumbered';
	}

	function isPreservedState(notice: (typeof notices)[number]): boolean {
		return isSourceDeleted(notice) || isRenumbered(notice);
	}

	function handlePaginationClick(event: MouseEvent, targetPage: number) {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		event.preventDefault();
		pendingPaginationPage = targetPage;
		const url = buildPageLink(targetPage);
		goto(url);
	}

	function handleFilterSubmit(event: Event) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);
		const params = new SvelteURLSearchParams();
		params.set('page', '1');
		const requestedLimit = Number.parseInt((formData.get('limit') || '').toString(), 10);
		const nextLimit = PAGE_SIZE_OPTIONS.includes(
			requestedLimit as (typeof PAGE_SIZE_OPTIONS)[number]
		)
			? requestedLimit
			: DEFAULT_PAGE_SIZE;
		params.set('limit', String(nextLimit));
		const search = (formData.get('search') || '').toString().trim();
		const startDate = (formData.get('startDate') || '').toString().trim();
		const endDate = (formData.get('endDate') || '').toString().trim();
		const sortOrder = (formData.get('sortOrder') || 'desc').toString();
		const searchModeVal = normalizeBoardSearchMode(
			(formData.get('searchMode') || searchMode).toString(),
			SEMANTIC_SEARCH_ENABLED
		);
		if (SEMANTIC_SEARCH_ENABLED) params.set('searchMode', searchModeVal);
		if (search) params.set('search', search);
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		if (sortOrder) params.set('sortOrder', sortOrder);
		// Hidden form fields carry link-based params (isDone, proposer) via FormData.
		const isDoneRaw = (formData.get('isDone') || '').toString().trim();
		if (isDoneRaw === 'true' || isDoneRaw === 'false') {
			params.set('isDone', isDoneRaw);
		}
		const proposerRaw = (formData.get('proposer') || '').toString().trim();
		if (proposerRaw) params.set('proposer', proposerRaw);
		// digest/noticeNums are read from URL as fallback (no hidden field).
		const liveUrl = new URL(window.location.href);
		const digestRaw = liveUrl.searchParams.get('digest');
		if (digestRaw === '1' || digestRaw === 'true') {
			params.set('digest', '1');
		}
		const noticeNumsRaw = liveUrl.searchParams.get('noticeNums');
		if (noticeNumsRaw?.trim()) {
			params.set('noticeNums', noticeNumsRaw.trim());
		}
		goto(`/notices?${params.toString()}`);
	}

	function handleSearchInputKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.isComposing) {
			return;
		}

		const input = event.currentTarget as HTMLInputElement | null;
		const form = input?.form;
		if (!form) {
			return;
		}

		// Mobile keyboards can skip implicit form submit for Enter; submit explicitly.
		event.preventDefault();
		form.requestSubmit();
	}
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	url={canonicalUrl}
	keywords={pageKeywords}
/>

<div class="lc-page-shell">
	<Header />

	<main
		id="main-content"
		class="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
		aria-labelledby="notices-page-title"
		data-testid="notices-main"
	>
		<nav class="mb-8 flex items-center space-x-3 text-sm" aria-label="이동 경로">
			<a
				href="../"
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2 transition-all duration-200"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				메인으로
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<span class="lc-text-secondary font-semibold">전체 입법예고</span>
		</nav>

		{#if aiSummaryEnabled}
			<div class="lc-banner-warning mb-6 rounded-xl border p-4 shadow-sm">
				<div class="flex items-start gap-3">
					<div class="lc-chip-warning mt-0.5 rounded-full p-1.5">
						<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
					</div>
					<div>
						<p class="text-sm font-semibold">안내</p>
						<p class="mt-1 text-sm leading-relaxed">
							AI 요약은 참고용으로 제공되며 해석상 오류가 있을 수 있습니다. 중요 판단 전 반드시 각
							법률안의 원문(제안이유 및 주요내용)을 함께 확인해주세요.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<section
			class="lc-panel-card mb-6 flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm"
			role="status"
			aria-live="polite"
			aria-labelledby="notices-page-title"
			data-testid="notices-results-summary"
		>
			<p class="lc-text-secondary text-sm font-medium">
				{hasActiveFilters ? '현재 검색 결과' : '입법예고 아카이브 건수'}
			</p>
			<p class="lc-text-primary text-lg font-bold">
				{#if hasActiveFilters}
					{totalItems.toLocaleString('ko-KR')}건
					<span class="lc-text-muted ml-1 text-sm font-medium"
						>/ 전체 {archiveCount.toLocaleString('ko-KR')}건</span
					>
				{:else}
					{archiveCount.toLocaleString('ko-KR')}건
				{/if}
			</p>
		</section>

		{#if archive?.appliedMode === 'semantic' && searchQuery.trim() && notices.length > 0}
			<p class="lc-text-dim -mt-4 mb-6 text-xs" data-testid="notices-semantic-scope-note">
				관련도순 상위 결과를 보여드려요. 전체 결과는 <a
					href={buildFilterLink({ searchMode: 'keyword' })}
					class="lc-link"
					data-testid="notices-semantic-scope-keyword">키워드 검색</a
				>에서 확인할 수 있어요.
				{#if keywordCountState === 'idle'}
					<button
						type="button"
						class="lc-link cursor-pointer"
						data-testid="notices-semantic-scope-count"
						onclick={loadKeywordCount}
					>
						같은 조건의 키워드 결과 건수 보기
					</button>
				{:else if keywordCountState === 'loading'}
					<span data-testid="notices-semantic-scope-count-loading">건수 확인 중…</span>
				{:else if keywordCountState === 'ready'}
					<span data-testid="notices-semantic-scope-count-result">
						키워드 검색은 같은 조건에서 {keywordCount?.toLocaleString('ko-KR')}건이에요.
					</span>
				{:else}
					<span data-testid="notices-semantic-scope-count-error"
						>건수를 확인하지 못했어요. 키워드 검색에서 직접 봐주세요.</span
					>
				{/if}
			</p>
		{/if}

		<section
			class="relative"
			aria-labelledby="notices-page-title"
			data-testid="notices-page-region"
		>
			<RateLimitOverlay
				visible={Boolean(data.loadError)}
				retryAfter={countdown}
				onRetry={() => retry.retry()}
				{isRetrying}
			/>
			<div class:opacity-60={Boolean(data.loadError)}>
				<h1 id="notices-page-title" class="sr-only">전체 입법예고</h1>
				{#if !isDigestContext}
					<section class="lc-panel-card mb-5 rounded-xl border p-4 shadow-sm">
						<form
							method="GET"
							action="/notices"
							class:pointer-events-none={isServerLoading}
							class:opacity-80={isServerLoading}
							aria-busy={isServerLoading}
							aria-describedby="notices-filter-help"
							data-testid="notices-filter-form"
							onsubmit={handleFilterSubmit}
						>
							<p id="notices-filter-help" class="sr-only">
								키워드, 기간, 상태, 정렬로 입법예고 목록을 필터링합니다. 검색어는 제안이유(원문)까지
								함께 찾습니다.
							</p>
							<div class="mb-2 flex flex-wrap items-center gap-2">
								<span id="notices-quick-date-heading" class="lc-text-muted text-xs font-semibold"
									>빠른 기간</span
								>
								<a
									href={buildFilterLink({ startDate: quickStart7Days, endDate: todayInputDate })}
									data-testid="notices-quick-range-7-days"
									class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
										isQuick7DaysActive ? 'lc-chip-blue' : 'lc-button-neutral'
									}`}
								>
									최근 7일
								</a>
								<a
									href={buildFilterLink({ startDate: quickStart30Days, endDate: todayInputDate })}
									data-testid="notices-quick-range-30-days"
									class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
										isQuick30DaysActive ? 'lc-chip-blue' : 'lc-button-neutral'
									}`}
								>
									최근 30일
								</a>
								<a
									href={buildFilterLink({ startDate: quickMonthStart, endDate: todayInputDate })}
									data-testid="notices-quick-range-this-month"
									class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
										isQuickThisMonthActive ? 'lc-chip-blue' : 'lc-button-neutral'
									}`}
								>
									이번 달
								</a>
								<a
									href={buildFilterLink({ startDate: '', endDate: '' })}
									data-testid="notices-quick-range-clear"
									class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
										isQuickClearRangeActive ? 'lc-chip-blue' : 'lc-button-neutral'
									}`}
								>
									기간 해제
								</a>
								<span class="hidden h-4 w-px bg-[var(--lc-border-soft)] sm:block"></span>
								<div
									class="lc-chip-group inline-flex items-center rounded-full border p-0.5 text-xs font-semibold"
									role="group"
									aria-label="입법예고 상태 필터"
									data-testid="notices-status-filter"
								>
									<a
										href={buildFilterLink({ isDone: null })}
										data-testid="notices-status-filter-all"
										class={`rounded-full px-3 py-1 transition-colors ${
											isDoneFilter === undefined
												? 'bg-[var(--lc-surface-primary)] text-[var(--lc-text-primary)] shadow-sm'
												: 'lc-text-muted hover:text-[var(--lc-text-secondary)]'
										}`}
									>
										전체
									</a>
									<a
										href={buildFilterLink({ isDone: false })}
										data-testid="notices-status-filter-active"
										class={`rounded-full px-3 py-1 transition-colors ${
											isDoneFilter === false
												? 'lc-chip-success shadow-sm'
												: 'lc-text-muted hover:text-[var(--lc-text-secondary)]'
										}`}
									>
										진행 중
									</a>
									<a
										href={buildFilterLink({ isDone: isDoneFilter === true ? null : true })}
										data-testid="notices-status-filter-done"
										class={`rounded-full px-3 py-1 transition-colors ${
											isDoneFilter === true
												? 'lc-chip-muted shadow-sm'
												: 'lc-text-muted hover:text-[var(--lc-text-secondary)]'
										}`}
									>
										종료된
									</a>
								</div>
							</div>
							<div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center">
								<div class="relative flex-1">
									<label for="archive-search" class="sr-only">검색어</label>
									<FontAwesomeIcon
										icon={faMagnifyingGlass}
										class="lc-text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
									/>
									<input
										id="archive-search"
										type="search"
										name="search"
										value={searchQuery}
										enterkeyhint="search"
										placeholder="법률안명, 소관위원회, 제안자, 제안이유 검색"
										data-testid="notices-search-input"
										class="lc-input lc-input-focus w-full rounded-lg border py-2 pr-3 pl-10 text-sm shadow-sm"
										onkeydown={handleSearchInputKeydown}
									/>
								</div>
								<label for="archive-start-date" class="sr-only">시작일</label>
								<input
									id="archive-start-date"
									type="date"
									name="startDate"
									value={startDate}
									max={endDate || undefined}
									data-testid="notices-start-date"
									class="lc-input lc-input-focus rounded-lg border px-3 py-2 text-sm shadow-sm"
									title="시작일"
								/>
								<label for="archive-end-date" class="sr-only">종료일</label>
								<input
									id="archive-end-date"
									type="date"
									name="endDate"
									value={endDate}
									min={startDate || undefined}
									data-testid="notices-end-date"
									class="lc-input lc-input-focus rounded-lg border px-3 py-2 text-sm shadow-sm"
									title="종료일"
								/>
								{#if archive?.appliedMode === 'semantic'}
									<span
										class="lc-chip-purple inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold"
										title="의미 검색은 관련도순으로 정렬됩니다."
										data-testid="notices-sort-relevance"
									>
										관련도순
									</span>
									<input type="hidden" name="sortOrder" value={sortOrder} />
								{:else}
									<label for="archive-sort-order" class="sr-only">정렬</label>
									<select
										id="archive-sort-order"
										name="sortOrder"
										value={sortOrder}
										data-testid="notices-sort-order"
										class="lc-input lc-input-focus rounded-lg border px-3 py-2 text-sm shadow-sm"
									>
										<option value="desc">내림차순</option>
										<option value="asc">오름차순</option>
									</select>
								{/if}
								<label for="archive-limit" class="sr-only">페이지당 개수</label>
								<select
									id="archive-limit"
									name="limit"
									value={String(limit)}
									data-testid="notices-page-size"
									class="lc-input lc-input-focus rounded-lg border px-3 py-2 text-sm shadow-sm"
									title="페이지당 개수"
								>
									{#each PAGE_SIZE_OPTIONS as size (size)}
										<option value={String(size)}>{size}개씩</option>
									{/each}
								</select>
								<input type="hidden" name="page" value="1" />
								<input type="hidden" name="searchMode" value={searchMode} />
								{#if isDoneFilter !== undefined}
									<input type="hidden" name="isDone" value={String(isDoneFilter)} />
								{/if}
								{#if proposerQuery.trim()}
									<input type="hidden" name="proposer" value={proposerQuery.trim()} />
								{/if}
							</div>
							{#if SEMANTIC_SEARCH_ENABLED}
								<div
									class="mt-2 flex flex-wrap items-center gap-2"
									data-testid="notices-search-mode"
								>
									<span class="lc-text-muted text-xs font-semibold">검색 방식</span>
									<div
										class="lc-chip-group inline-flex items-center rounded-full border p-0.5 text-xs font-semibold"
										role="group"
										aria-label="검색 방식"
									>
										{#each BOARD_SEARCH_MODES as mode (mode)}
											<a
												href={buildFilterLink({ searchMode: mode })}
												data-testid={`notices-search-mode-${mode}`}
												aria-current={searchMode === mode ? 'true' : undefined}
												title={BOARD_SEARCH_MODE_HINTS[mode]}
												class={`rounded-full px-3 py-1 transition-colors ${
													searchMode === mode
														? 'bg-[var(--lc-surface-primary)] text-[var(--lc-text-primary)] shadow-sm'
														: 'lc-text-muted hover:text-[var(--lc-text-secondary)]'
												}`}
											>
												{BOARD_SEARCH_MODE_LABELS[mode]}
											</a>
										{/each}
									</div>
									<span class="lc-text-dim text-xs" data-testid="notices-search-mode-hint">
										{BOARD_SEARCH_MODE_HINTS[searchMode]}
									</span>
								</div>
								{#if !searchQuery.trim() && exampleQueries.length > 0}
									<div
										class="mt-2 flex flex-wrap items-center gap-2 text-xs"
										data-testid="notices-example-queries"
									>
										<span class="lc-text-muted font-semibold">예시 검색어</span>
										{#each exampleQueries as example, index (example)}
											<a
												href={buildFilterLink({ search: example, searchMode: 'auto' })}
												data-testid={`notices-example-query-${index}`}
												title="이 예시로 의미 검색을 실행합니다."
												class="lc-chip-muted inline-flex items-center rounded-full px-2 py-1 font-semibold transition-colors hover:-translate-y-0.5"
											>
												{example}
											</a>
										{/each}
									</div>
								{/if}
							{/if}
							{#if hasDateReversed}
								<p class="lc-text-warning mt-2 text-xs font-medium">
									시작일이 종료일보다 늦습니다. 검색 시 서버에서 자동으로 범위를 보정합니다.
								</p>
							{/if}
							{#if hasActiveFilters}
								<div
									class="mt-2 flex flex-wrap items-center gap-2 text-xs"
									data-testid="notices-active-filters"
								>
									<span class="lc-text-muted font-semibold">적용된 필터</span>
									{#if searchQuery.trim()}
										<span
											class="lc-chip-blue inline-flex items-center rounded-full px-2 py-1 font-semibold"
										>
											키워드: {searchQuery.trim()}
											<a
												href={buildFilterLink({ search: '' })}
												class="lc-link ml-2"
												aria-label="키워드 검색 해제"
											>
												<FontAwesomeIcon icon={faXmark} class="h-2.5 w-2.5" />
											</a>
										</span>
									{/if}
									{#if proposerQuery.trim()}
										<span
											class="lc-chip-cyan inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold"
										>
											<FontAwesomeIcon icon={faUser} class="h-2.5 w-2.5" />
											제안자: {proposerQuery.trim()}
											<a
												href={buildFilterLink({ proposer: '' })}
												class="lc-link ml-1"
												aria-label="제안자 검색 해제"
											>
												<FontAwesomeIcon icon={faXmark} class="h-2.5 w-2.5" />
											</a>
										</span>
									{/if}
									{#if startDate.trim() || endDate.trim()}
										<span
											class="lc-chip-success inline-flex items-center rounded-full px-2 py-1 font-semibold"
										>
											기간: {startDate || '처음'} ~ {endDate || '현재'}
											<a
												href={buildFilterLink({ startDate: '', endDate: '' })}
												class="lc-link ml-2"
											>
												해제
											</a>
										</span>
									{/if}
									{#if isDoneFilter !== undefined}
										<span
											class={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
												isDoneFilter ? 'lc-chip-muted' : 'lc-chip-success'
											}`}
										>
											{#if isDoneFilter}
												<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
												종료된 입법예고만
											{:else}
												<span class="lc-dot-success h-1.5 w-1.5 rounded-full"></span>
												진행 중인 입법예고만
											{/if}
											<a
												href={buildFilterLink({ isDone: null })}
												class="ml-1 opacity-60 hover:opacity-100"
												aria-label="상태 필터 해제"
											>
												<FontAwesomeIcon icon={faXmark} class="h-2.5 w-2.5" />
											</a>
										</span>
									{/if}
									<span
										class="lc-chip-muted inline-flex items-center rounded-full px-2 py-1 font-semibold"
									>
										정렬: {sortOrder === 'asc' ? '오름차순' : '내림차순'}
										{#if sortOrder !== 'desc'}
											<a href={buildFilterLink({ sortOrder: 'desc' })} class="lc-link ml-2">
												기본값
											</a>
										{/if}
									</span>
								</div>
							{/if}
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<button
									type="submit"
									disabled={isServerLoading}
									data-testid="notices-search-submit"
									class="lc-button-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{#if isServerLoading}
										<FontAwesomeIcon icon={faSpinner} class="mr-2 h-4 w-4 animate-spin" />
										불러오는 중
									{:else}
										검색
									{/if}
								</button>
								<a
									href="/notices"
									data-testid="notices-reset-filters"
									class="lc-button-neutral inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
								>
									필터 초기화
								</a>
							</div>
							{#if isServerLoading}
								<div
									class="lc-loading-track mt-3 h-1 w-full overflow-hidden rounded-full"
									role="status"
									aria-live="polite"
								>
									<span class="sr-only">불러오는 중...</span>
									<div class="lc-loading-fill lc-loading-slide h-full w-1/3 rounded-full"></div>
								</div>
							{/if}
						</form>
					</section>
				{:else}
					<section
						class="lc-panel-card mb-5 rounded-xl border p-4 shadow-sm"
						aria-live="polite"
						data-testid="notices-digest-custom-view"
					>
						<p class="lc-text-primary text-sm font-semibold">신규 감지 항목 모아보기</p>
						<p class="lc-text-secondary mt-1 text-sm">
							최근에 신규 감지된 법률안을 모아 보여드리고 있습니다.
						</p>
						<div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
							<span
								class="lc-chip-blue inline-flex items-center rounded-full px-2 py-1 font-semibold"
							>
								감지 대상 {digestNoticeNums.length.toLocaleString('ko-KR')}건
							</span>
							<a
								href="/notices"
								class="lc-button-neutral inline-flex items-center justify-center rounded-lg border px-3 py-1.5 font-semibold transition-colors"
							>
								전체 목록 보기
							</a>
						</div>
					</section>
				{/if}

				{#if boardSemantic?.mode === 'keyword_fallback'}
					<div
						class="lc-banner-warning mb-5 rounded-xl border p-4 shadow-sm"
						data-testid="notices-semantic-fallback-banner"
					>
						<div class="flex items-start gap-3">
							<div class="lc-chip-warning mt-0.5 rounded-full p-1.5">
								<FontAwesomeIcon icon={faWandMagicSparkles} class="h-4 w-4" />
							</div>
							<div>
								<p class="lc-text-primary text-sm font-semibold">
									키워드 검색 결과를 표시하고 있습니다
								</p>
								<p class="lc-text-secondary mt-1 text-sm">{boardSemantic.fallbackReason}</p>
							</div>
						</div>
					</div>
				{/if}

				<section
					class="relative"
					aria-labelledby="notices-results-heading"
					data-testid="notices-results-region"
				>
					<h2 id="notices-results-heading" class="sr-only">입법예고 검색 결과</h2>
					{#if showingWeak}
						<div
							class="lc-banner-warning mb-3 rounded-xl border p-3 shadow-sm"
							data-testid="notices-semantic-weak-banner"
						>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="lc-text-secondary text-sm">
									명확한 검색 결과가 없어 관련도가 낮은 결과를 표시하고 있습니다.
								</p>
								{#if hasMoreWeak}
									<span class="lc-text-dim text-xs" data-testid="notices-semantic-weak-progress">
										{describeWeakProgress(weakVisibleResults.length, weakResults.length)}
									</span>
								{/if}
								<button
									type="button"
									class="lc-button-neutral cursor-pointer rounded-lg border px-3 py-1.5 text-sm"
									data-testid="notices-semantic-hide-weak"
									onclick={hideWeakResults}
								>
									숨기기
								</button>
							</div>
						</div>
						<div class="space-y-4" data-testid="notices-semantic-weak-list">
							{#each weakVisibleResults as result (result.noticeNum)}
								<article
									class="lc-notice-card lc-notice-border-active rounded-lg border-l-4 p-4 shadow sm:p-6"
									data-testid={`notices-weak-result-${result.noticeNum}`}
								>
									<div class="flex flex-wrap items-center gap-2">
										<span
											class="lc-chip-blue inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
										>
											의안번호 {result.noticeNum}
										</span>
										{#if result.score !== null}
											<span
												class="lc-chip-success inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
												title={BOARD_RELEVANCE_HINTS.score}
											>
												유사도 {formatSimilarityPercent(result.score)}
											</span>
										{/if}
										{#if result.section}
											<span
												class="lc-chip-purple inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
												title={BOARD_RELEVANCE_HINTS.section}
											>
												{formatSectionLabel(result.section)}
											</span>
										{/if}
										{#if result.committee}
											<span
												class="lc-chip-muted inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
											>
												{result.committee}
											</span>
										{/if}
									</div>
									<h3 class="lc-text-primary mt-2 text-lg font-bold">
										<a href={`/notices/${result.noticeNum}`} class="lc-link">{result.subject}</a>
									</h3>
									{#if result.excerpt}
										<p
											class="lc-text-secondary mt-2 whitespace-pre-line text-sm"
											title={BOARD_RELEVANCE_HINTS.excerpt}
										>
											{result.excerpt}
										</p>
									{/if}
								</article>
							{/each}
							{#if hasMoreWeak}
								<div class="pt-1 text-center">
									<button
										type="button"
										class="lc-button-neutral cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
										data-testid="notices-semantic-weak-more"
										onclick={showMoreWeakResults}
									>
										관련도가 낮은 결과 더 보기 ({weakVisibleResults.length}/{weakResults.length})
									</button>
								</div>
							{/if}
						</div>
					{:else if notices.length === 0}
						<div
							class="lc-empty-state rounded-2xl border p-16 text-center shadow-xl"
							data-testid="notices-empty-state"
						>
							<div class="lc-empty-state-icon mb-6 inline-block rounded-full p-6">
								<FontAwesomeIcon icon={faBell} class="lc-text-dim h-16 w-16" />
							</div>
							{#if weakResults.length > 0}
								<h3 class="lc-text-primary mb-3 text-2xl font-bold">명확한 검색 결과가 없습니다</h3>
								<p class="lc-text-secondary mb-4 text-sm" data-testid="notices-semantic-weak-offer">
									{describeWeakReveal(weakResults.length)}
								</p>
								<div class="flex flex-wrap items-center justify-center gap-2">
									<button
										type="button"
										class="lc-button-neutral cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
										data-testid="notices-semantic-show-weak"
										onclick={revealWeakResults}
									>
										관련도가 낮은 결과 보기
									</button>
									{#if searchQuery.trim() && archive?.appliedMode === 'semantic'}
										<!-- Weak band instead of a clear answer: the exhaustive keyword
										     path (which includes `제안이유`) is the more useful escape, so
										     offer it alongside the low-relevance list rather than only
										     inside the plain empty state. -->
										<a
											href={buildFilterLink({ searchMode: 'keyword' })}
											data-testid="notices-empty-try-keyword"
											title="법률안명·소관위원회·제안자·제안이유를 그대로 찾는 키워드 검색으로 다시 찾아봅니다."
											class="lc-button-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
										>
											<FontAwesomeIcon icon={faMagnifyingGlass} class="mr-2 h-4 w-4" />
											키워드 검색으로 다시 찾기
										</a>
									{/if}
								</div>
							{:else}
								<h3 class="lc-text-primary mb-3 text-2xl font-bold">
									{hasActiveFilters ? '검색 결과가 없습니다' : '입법예고가 없습니다'}
								</h3>
								{#if hasActiveFilters}
									<p class="lc-text-secondary text-sm">다른 키워드로 다시 검색해보세요.</p>
								{/if}
								{#if hasNonKeywordFilters || (searchQuery.trim() && (SEMANTIC_SEARCH_ENABLED || archive?.appliedMode === 'semantic'))}
									<div class="mt-4 flex flex-wrap items-center justify-center gap-2">
										{#if searchQuery.trim() && archive?.appliedMode === 'semantic'}
											<a
												href={buildFilterLink({ searchMode: 'keyword' })}
												data-testid="notices-empty-try-keyword"
												title="법률안명·소관위원회·제안자를 그대로 찾는 키워드 검색으로 다시 찾아봅니다."
												class="lc-button-neutral inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
											>
												<FontAwesomeIcon icon={faMagnifyingGlass} class="mr-2 h-4 w-4" />
												키워드 검색으로 다시 찾기
											</a>
										{/if}
										{#if SEMANTIC_SEARCH_ENABLED && searchQuery.trim() && archive?.appliedMode !== 'semantic'}
											<a
												href={buildFilterLink({ searchMode: 'auto' })}
												data-testid="notices-empty-try-semantic"
												title="질문처럼 다시 찾아봅니다. 의미 검색 엔진을 쓸 수 없으면 키워드 결과를 보여드려요."
												class="lc-button-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
											>
												<FontAwesomeIcon icon={faWandMagicSparkles} class="mr-2 h-4 w-4" />
												의미 검색으로 다시 찾기
											</a>
										{/if}
										{#if hasNonKeywordFilters}
											<a
												href={buildFilterLink({
													proposer: '',
													startDate: '',
													endDate: '',
													isDone: null
												})}
												data-testid="notices-empty-reset-filters"
												class="lc-button-neutral inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
											>
												<FontAwesomeIcon icon={faXmark} class="mr-2 h-4 w-4" />
												기간·상태 조건 지우기
											</a>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
					{:else}
						<div
							class="space-y-4"
							class:opacity-85={isServerLoading}
							data-testid="notices-results-list"
						>
							{#each notices as notice, index (notice.num)}
								{@const proposerNames = extractProposerFromSubject(notice.subject)}
								{@const proposerDisplay = proposerNames.join(', ')}
								{@const deadline = buildNoticeDeadline(notice.noticePeriod, notice.isDone ?? null)}
								<article
									aria-labelledby="notice-heading-{notice.num}"
									data-testid={`notice-card-${notice.num}`}
									class={`lc-notice-card rounded-lg border-l-4 p-4 shadow transition-shadow hover:shadow-md sm:p-6 ${
										notice.isDone
											? 'lc-notice-card-done lc-notice-border-done'
											: 'lc-notice-border-active'
									}`}
									class:lc-defer-render-sm={index > 1}
								>
									<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div class="min-w-0 flex-1">
											<div class="mb-3 flex flex-wrap items-center gap-2">
												<span
													class="lc-chip-blue inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
												>
													의안번호 {notice.num}
												</span>
												{#if notice.isDone}
													<span
														class="lc-chip-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
													>
														<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
														입법예고 종료
													</span>
												{:else}
													<span
														class="lc-chip-success inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
													>
														<span class="lc-dot-success h-1.5 w-1.5 rounded-full"></span>
														진행 중
													</span>
												{/if}
												{#if deadline.kind !== 'none'}
													<span
														class={`${deadline.kind === 'open' ? 'lc-chip-danger' : 'lc-chip-muted'} inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold`}
														data-testid={`notice-deadline-chip-${notice.num}`}
													>
														{deadline.label}
													</span>
												{/if}
												{#if isSourceDeleted(notice)}
													<span
														class="lc-chip-warning inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
													>
														<FontAwesomeIcon icon={faTriangleExclamation} class="h-2.5 w-2.5" />
														소스 미존재(보존)
													</span>
												{:else if isRenumbered(notice)}
													<span
														class="lc-chip-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
													>
														<FontAwesomeIcon icon={faRotate} class="h-2.5 w-2.5" />
														보존 상태 전환(번호 변경)
													</span>
												{/if}
												{#if notice.changeEventCount !== undefined}
													<span
														class="lc-chip-muted inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
													>
														변경 기록 {(notice.changeEventCount - 1).toLocaleString('ko-KR')}건
													</span>
												{/if}
												{#if notice.relevance?.score !== null && notice.relevance?.score !== undefined}
													<span
														class="lc-chip-success inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
														title={BOARD_RELEVANCE_HINTS.score}
														data-testid={`notice-relevance-score-${notice.num}`}
													>
														유사도 {formatSimilarityPercent(notice.relevance.score)}
													</span>
												{/if}
												{#if notice.relevance?.section}
													<span
														class="lc-chip-purple inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
														title={BOARD_RELEVANCE_HINTS.section}
														data-testid={`notice-relevance-section-${notice.num}`}
													>
														{formatSectionLabel(notice.relevance.section)}
													</span>
												{/if}
											</div>

											<h3
												id="notice-heading-{notice.num}"
												class={`mb-3 text-lg leading-tight font-semibold wrap-break-word ${notice.isDone ? 'lc-text-muted' : 'lc-text-primary'}`}
											>
												<a
													href={`/notices/${notice.num}?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&sortOrder=${sortOrder}`}
													data-testid={`notice-detail-link-${notice.num}`}
													class={`no-underline transition-colors duration-150 ${notice.isDone ? 'hover:text-[var(--lc-text-secondary)]' : 'hover:text-[var(--lc-text-accent)]'}`}
												>
													{notice.subject}
												</a>
											</h3>

											{#if notice.relevance?.excerpt}
												<p
													class="lc-text-secondary mb-3 whitespace-pre-line text-sm"
													title={BOARD_RELEVANCE_HINTS.excerpt}
													data-testid={`notice-relevance-excerpt-${notice.num}`}
												>
													{notice.relevance.excerpt}
												</p>
											{/if}

											<div class="lc-text-secondary flex flex-wrap gap-4 text-sm">
												<div class="flex items-center">
													<FontAwesomeIcon icon={faCalendar} class="mr-1 h-4 w-4" />
													제안자 구분: {notice.proposerCategory}
												</div>
												<div class="flex items-center">
													<FontAwesomeIcon icon={faBell} class="mr-1 h-4 w-4" />
													소관위원회: {notice.committee === '' ? '(미정)' : notice.committee}
												</div>
											</div>

											{#if isPreservedState(notice)}
												<p class="lc-text-warning mt-2 text-xs font-medium">
													{#if isSourceDeleted(notice)}
														보존 상태로 전환되었습니다. (사유: 원본 소스 미존재)
													{:else}
														보존 상태로 전환되었습니다. (사유: 의안번호 변경)
													{/if}
												</p>
											{/if}

											{#if shouldShowAIBriefing(notice)}
												<AIBriefingCard
													summary={notice.aiSummary ?? null}
													status={notice.aiSummaryStatus ?? 'unavailable'}
												/>
											{/if}
										</div>

										<div
											class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end lg:ml-4 lg:w-auto lg:shrink-0"
										>
											<a
												href={`/notices/${notice.num}?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&sortOrder=${sortOrder}`}
												data-testid={`notice-open-summary-${notice.num}`}
												class="lc-chip-cyan inline-flex items-center rounded-md px-2.5 py-2 text-xs font-semibold transition-colors"
												title="제안이유 및 주요내용 원문 조회"
											>
												원문 조회
											</a>

											{#if notice.attachments && (isDownloadable(notice.attachments.pdfFile) || isDownloadable(notice.attachments.hwpFile))}
												<div class="flex items-center gap-1">
													{#if isDownloadable(notice.attachments.pdfFile)}
														<button
															onclick={() =>
																downloadFile(notice.attachments.pdfFile, `${notice.num}.pdf`)}
															aria-label="PDF 다운로드"
															data-testid={`notice-download-pdf-${notice.num}`}
															class="lc-action-chip-red cursor-pointer rounded-md p-2.5 transition-colors"
														>
															<FontAwesomeIcon icon={faFileText} class="h-5 w-5" />
														</button>
													{/if}
													{#if isDownloadable(notice.attachments.hwpFile)}
														<button
															onclick={() =>
																downloadFile(notice.attachments.hwpFile, `${notice.num}.hwp`)}
															aria-label="HWP 다운로드"
															data-testid={`notice-download-hwp-${notice.num}`}
															class="lc-action-chip-blue cursor-pointer rounded-md p-2.5 transition-colors"
														>
															<FontAwesomeIcon icon={faFileDownload} class="h-5 w-5" />
														</button>
													{/if}
													<div class="hidden h-6 w-px bg-[var(--lc-border-soft)] sm:block"></div>
												</div>
											{/if}
											<button
												onclick={() => openExternalLink(notice.link)}
												aria-label="자세히 보기 (새 탭)"
												data-testid={`notice-open-external-${notice.num}`}
												class="lc-button-neutral cursor-pointer rounded-md p-2.5 transition-colors"
											>
												<FontAwesomeIcon icon={faExternalLink} class="h-5 w-5" />
											</button>
										</div>
									</div>
								</article>
							{/each}
						</div>

						<PaginationNav
							{currentPage}
							{totalPages}
							{totalItems}
							{limit}
							pendingPage={pendingPaginationPage}
							buildHref={buildPageLink}
							onPageClick={handlePaginationClick}
							ariaLabel="페이지 내비게이션"
							testId="notices-pagination"
						/>
					{/if}

					{#if SEMANTIC_SEARCH_ENABLED}
						<div class="mt-6 flex justify-end px-2">
							<a
								href={buildSemanticSearchHref(searchQuery)}
								data-testid="semantic-search-entry"
								class="lc-button-neutral inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
							>
								<FontAwesomeIcon icon={faWandMagicSparkles} class="mr-2 h-4 w-4" />
								의미 검색
							</a>
						</div>
					{/if}

					<LoadingOverlay visible={isServerLoading} />
				</section>
			</div>
		</section>
	</main>
</div>

<style>
	a {
		text-decoration: none;
	}

	a:hover {
		text-decoration: none;
	}
</style>
