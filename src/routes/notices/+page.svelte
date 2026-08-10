<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import PaginationNav from '$lib/components/PaginationNav.svelte';
	import { openExternalLink, downloadFile, isDownloadable } from '$lib/utils/helpers';
	import { page } from '$app/state';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
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
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import type { ArchiveNoticeListResponse } from '$lib/types/api';
	import { KST_TIMEZONE } from '$lib/utils/helpers';

	export let data: {
		archive: ArchiveNoticeListResponse;
		digestContext?: {
			isDigestContext: boolean;
			noticeNums: number[];
		};
		error?: string;
	};

	let currentUrl = page.url;
	let isServerLoading = false;

	beforeNavigate(({ to }) => {
		isServerLoading = !!to?.url && to.url.pathname.replace(/\/+$/, '') === '/notices';
	});

	afterNavigate(() => {
		currentUrl = page.url;
		isServerLoading = false;
	});

	$: archive = data.archive;
	$: notices = archive?.items || [];
	$: currentPage = archive?.page || 1;
	$: totalPages = archive?.totalPages || 1;
	$: totalItems = archive?.total || 0;
	$: limit = archive?.limit || 10;
	$: searchQuery = archive?.search || '';
	$: startDate = archive?.startDate || '';
	$: endDate = archive?.endDate || '';
	$: sortOrder = archive?.sortOrder === 'asc' ? 'asc' : 'desc';
	$: isDoneFilter = (() => {
		const v = currentUrl.searchParams.get('isDone');
		return v === 'true' ? true : v === 'false' ? false : undefined;
	})();
	$: fullText = currentUrl.searchParams.get('fullText') === 'true';
	$: digestContext = data.digestContext;
	$: isDigestContext = digestContext?.isDigestContext === true;
	$: digestNoticeNums = digestContext?.noticeNums ?? [];
	$: aiSummaryEnabled = archive?.aiSummaryEnabled !== false;
	$: hasActiveFilters =
		searchQuery.trim().length > 0 ||
		startDate.trim().length > 0 ||
		endDate.trim().length > 0 ||
		isDoneFilter !== undefined ||
		fullText;
	$: archiveCount = archive?.stats?.totalArchiveCount ?? archive?.stats?.archiveCount ?? 0;

	$: canonicalUrl = (() => {
		const base = currentUrl.origin + currentUrl.pathname;
		if (!hasActiveFilters && currentPage > 1) {
			return `${base}?page=${currentPage}&limit=${limit}&sortOrder=${sortOrder}`;
		}
		return base;
	})();

	$: pageDescription = aiSummaryEnabled
		? '입법예고 아카이브에서 키워드 검색과 법률안을 조회하고, 원문과 AI 요약을 확인할 수 있습니다.'
		: '입법예고 아카이브에서 키워드 검색과 법률안을 조회하고 원문을 확인할 수 있습니다.';

	let error = '';
	$: if (data) {
		error = data.error || '';
	}

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
	$: isQuick7DaysActive = startDate === quickStart7Days && endDate === todayInputDate;
	$: isQuick30DaysActive = startDate === quickStart30Days && endDate === todayInputDate;
	$: isQuickThisMonthActive = startDate === quickMonthStart && endDate === todayInputDate;
	$: isQuickClearRangeActive = !startDate.trim() && !endDate.trim();
	$: hasDateReversed =
		startDate.trim().length > 0 && endDate.trim().length > 0 && startDate > endDate;

	let pendingPaginationPage: number | null = null;
	let wasServerLoading = false;

	$: {
		if (wasServerLoading && !isServerLoading) {
			pendingPaginationPage = null;
		}
		// eslint-disable-next-line no-useless-assignment
		wasServerLoading = isServerLoading;
	}

	type QueryLinkOverrides = {
		page?: number;
		limit?: number;
		search?: string;
		startDate?: string;
		endDate?: string;
		sortOrder?: 'asc' | 'desc';
		isDone?: boolean | null;
		fullText?: boolean | null;
	};

	function buildQueryLink(overrides: QueryLinkOverrides = {}) {
		const pg = overrides.page !== undefined ? overrides.page : currentPage;
		const lim = overrides.limit !== undefined ? overrides.limit : limit;
		const q = (overrides.search !== undefined ? overrides.search : searchQuery).trim();
		const sd = (overrides.startDate !== undefined ? overrides.startDate : startDate).trim();
		const ed = (overrides.endDate !== undefined ? overrides.endDate : endDate).trim();
		const so = overrides.sortOrder !== undefined ? overrides.sortOrder : sortOrder;
		const id = 'isDone' in overrides ? overrides.isDone : isDoneFilter;
		const ft = 'fullText' in overrides ? overrides.fullText : fullText ? true : null;

		const params = new SvelteURLSearchParams(currentUrl.searchParams);
		params.set('page', String(pg));
		params.set('limit', String(lim));
		if (q) params.set('search', q);
		else params.delete('search');
		if (sd) params.set('startDate', sd);
		else params.delete('startDate');
		if (ed) params.set('endDate', ed);
		else params.delete('endDate');
		params.set('sortOrder', so);
		if (id !== null && id !== undefined) params.set('isDone', String(id));
		else params.delete('isDone');
		if (ft) params.set('fullText', 'true');
		else params.delete('fullText');

		// Keep digest context normalized when present.
		const digestRaw = params.get('digest');
		if (digestRaw === 'true') {
			params.set('digest', '1');
		}
		return `/notices?${params.toString()}`;
	}

	$: buildFilterLink = (
		(_ft: boolean, _id: boolean | undefined) =>
		(overrides: {
			search?: string;
			startDate?: string;
			endDate?: string;
			sortOrder?: 'asc' | 'desc';
			isDone?: boolean | null;
			fullText?: boolean | null;
		}) =>
			buildQueryLink({ page: 1, ...overrides })
	)(fullText, isDoneFilter);

	$: buildPageLink = (
		(_ft: boolean, _id: boolean | undefined) => (pg: number) =>
			buildQueryLink({ page: pg })
	)(fullText, isDoneFilter);

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
		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);
		const params = new SvelteURLSearchParams();
		params.set('page', '1');
		params.set('limit', String(limit));
		const search = (formData.get('search') || '').toString().trim();
		const startDate = (formData.get('startDate') || '').toString().trim();
		const endDate = (formData.get('endDate') || '').toString().trim();
		const sortOrder = (formData.get('sortOrder') || 'desc').toString();
		const fullTextVal = formData.get('fullText') === 'true';
		if (search) params.set('search', search);
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		if (sortOrder) params.set('sortOrder', sortOrder);
		if (fullTextVal) params.set('fullText', 'true');
		// isDone 필터는 링크 기반이므로 현재 URL에서 그대로 전달
		const currentIsDone = currentUrl.searchParams.get('isDone');
		if (currentIsDone) params.set('isDone', currentIsDone);
		const digestRaw = currentUrl.searchParams.get('digest');
		if (digestRaw === '1' || digestRaw === 'true') {
			params.set('digest', '1');
		}
		const noticeNumsRaw = currentUrl.searchParams.get('noticeNums');
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

<svelte:head>
	<title>
		{isDigestContext
			? '신규 감지 항목 모아보기'
			: `전체 입법예고 ${archiveCount > 0 ? ` (전체 ${archiveCount.toLocaleString('ko-KR')}건)` : ''}`}
		- LawCast
	</title>
	<link rel="canonical" href={canonicalUrl} />
	<meta name="description" content={pageDescription} />
	<meta
		name="keywords"
		content={aiSummaryEnabled
			? '전체 입법예고, 국회 법률안 목록, 법안 원문 조회, 제안이유 및 주요내용, AI 요약, 입법예고 아카이브, 법안 검색, 국회 입법예고 알림'
			: '전체 입법예고, 국회 법률안 목록, 법안 원문 조회, 제안이유 및 주요내용, 입법예고 아카이브, 법안 검색, 국회 입법예고 알림'}
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta
		property="og:title"
		content={`전체 입법예고${archiveCount > 0 ? ` (전체 ${archiveCount.toLocaleString('ko-KR')}건)` : ''} - LawCast`}
	/>
	<meta property="og:description" content={pageDescription} />
	<meta
		name="twitter:title"
		content={`전체 입법예고${archiveCount > 0 ? ` (전체 ${archiveCount.toLocaleString('ko-KR')}건)` : ''} - LawCast`}
	/>
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="page-shell">
	<Header />

	<main
		id="main-content"
		class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
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

		{#if error}
			<Alert type="error" message={error} dismissible={false} />
		{:else}
			<section aria-labelledby="notices-page-title" data-testid="notices-page-region">
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
							on:submit|preventDefault={handleFilterSubmit}
						>
							<p id="notices-filter-help" class="sr-only">
								키워드, 기간, 상태, 정렬, 원문 포함 여부로 입법예고 목록을 필터링합니다.
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
							<div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
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
										placeholder={fullText
											? '법률안명, 소관위원회, 원문 키워드 검색'
											: '법률안명, 소관위원회 검색'}
										data-testid="notices-search-input"
										class="lc-input lc-input-focus w-full rounded-lg border py-2 pr-3 pl-10 text-sm shadow-sm"
										on:keydown={handleSearchInputKeydown}
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
								<input type="hidden" name="page" value="1" />
								<input type="hidden" name="limit" value={String(limit)} />
								<input type="hidden" name="fullText" value={String(fullText)} />
							</div>
							<div class="mt-1.5 flex items-center">
								<a
									href={buildFilterLink({ fullText: fullText ? null : true })}
									title="원문(제안이유) 전체 텍스트 포함 검색. 속도가 느려질 수 있습니다."
									role="switch"
									aria-checked={fullText}
									data-testid="notices-full-text-toggle"
									class="group inline-flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 focus:ring-2 focus:ring-[var(--lc-border-strong)] focus:ring-offset-1 focus:outline-none"
								>
									<span
										class={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
											fullText ? 'lc-toggle-track-on' : 'lc-toggle-track-off'
										}`}
									>
										<span
											class={`inline-block h-4 w-4 rounded-full bg-[var(--lc-surface-primary)] shadow-sm transition-transform duration-200 ${
												fullText ? 'translate-x-4' : 'translate-x-0'
											}`}
										></span>
									</span>
									<span
										class={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
											fullText ? 'lc-chip-purple' : 'lc-text-dim'
										}`}
									>
										<FontAwesomeIcon icon={faFileText} class="h-3 w-3" />
										원문(제안이유) 포함 검색
									</span>
								</a>
							</div>
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
												class="lc-link ml-2 underline underline-offset-2"
											>
												해제
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
												class="lc-link ml-2 underline underline-offset-2"
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
												✕
											</a>
										</span>
									{/if}
									{#if fullText}
										<span
											class="lc-chip-purple inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold"
										>
											<FontAwesomeIcon icon={faFileText} class="h-2.5 w-2.5" />
											원문 포함 검색
											<a
												href={buildFilterLink({ fullText: null })}
												class="ml-1 opacity-60 hover:opacity-100"
												aria-label="원문 포함 검색 해제"
											>
												✕
											</a>
										</span>
									{/if}
									<span
										class="lc-chip-muted inline-flex items-center rounded-full px-2 py-1 font-semibold"
									>
										정렬: {sortOrder === 'asc' ? '오름차순' : '내림차순'}
										{#if sortOrder !== 'desc'}
											<a
												href={buildFilterLink({ sortOrder: 'desc' })}
												class="lc-link ml-2 underline underline-offset-2"
											>
												기본값
											</a>
										{/if}
									</span>
								</div>
							{/if}
							<div class="mt-2 flex items-center gap-2">
								<button
									type="submit"
									disabled={isServerLoading}
									data-testid="notices-search-submit"
									class="lc-button-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold"
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
									<div class="lc-loading-fill loading-slide h-full w-1/3 rounded-full"></div>
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

				<section
					class="relative"
					aria-labelledby="notices-results-heading"
					data-testid="notices-results-region"
				>
					<h2 id="notices-results-heading" class="sr-only">입법예고 검색 결과</h2>
					{#if notices.length === 0}
						<div
							class="lc-empty-state rounded-2xl border p-16 text-center shadow-xl"
							data-testid="notices-empty-state"
						>
							<div class="lc-empty-state-icon mb-6 inline-block rounded-full p-6">
								<FontAwesomeIcon icon={faBell} class="lc-text-dim h-16 w-16" />
							</div>
							<h3 class="lc-text-primary mb-3 text-2xl font-bold">
								{hasActiveFilters ? '검색 결과가 없습니다' : '입법예고가 없습니다'}
							</h3>
							{#if hasActiveFilters}
								<p class="lc-text-secondary text-sm">다른 키워드로 다시 검색해보세요.</p>
							{/if}
						</div>
					{:else}
						<div
							class="space-y-4"
							class:opacity-85={isServerLoading}
							data-testid="notices-results-list"
						>
							{#each notices as notice, index (notice.num)}
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

											<div class="lc-text-secondary flex flex-wrap gap-4 text-sm">
												<div class="flex items-center">
													<FontAwesomeIcon icon={faCalendar} class="mr-1 h-4 w-4" />
													제안자 구분: {notice.proposerCategory}
												</div>
												{#if notice.committee}
													<div class="flex items-center">
														<FontAwesomeIcon icon={faBell} class="mr-1 h-4 w-4" />
														소관위원회: {notice.committee}
													</div>
												{/if}
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
															on:click={() =>
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
															on:click={() =>
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
												on:click={() => openExternalLink(notice.link)}
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

					<LoadingOverlay visible={isServerLoading} />
				</section>
			</section>
		{/if}
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
