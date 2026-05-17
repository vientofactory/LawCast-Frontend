<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import { openExternalLink, downloadFile, isDownloadable } from '$lib/utils/helpers';
	import { navigating, page } from '$app/stores';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { SvelteDate, SvelteURLSearchParams } from 'svelte/reactivity';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faAnglesLeft,
		faAnglesRight,
		faBell,
		faCalendar,
		faChevronLeft,
		faChevronRight,
		faExternalLink,
		faFileDownload,
		faFileText,
		faLock,
		faMagnifyingGlass,
		faSpinner,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import type { ArchiveNoticeListResponse } from '$lib/types/api';

	export let data: {
		archive: ArchiveNoticeListResponse;
		error?: string;
	};

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
		const v = $page.url.searchParams.get('isDone');
		return v === 'true' ? true : v === 'false' ? false : undefined;
	})();
	$: aiSummaryEnabled = archive?.aiSummaryEnabled !== false;
	$: hasActiveFilters =
		searchQuery.trim().length > 0 ||
		startDate.trim().length > 0 ||
		endDate.trim().length > 0 ||
		isDoneFilter !== undefined;
	$: archiveCount = archive?.stats?.totalArchiveCount ?? archive?.stats?.archiveCount ?? 0;

	$: canonicalUrl = (() => {
		const base = $page.url.origin + $page.url.pathname;
		if (!hasActiveFilters && currentPage > 1) {
			return `${base}?page=${currentPage}&limit=${limit}&sortOrder=${sortOrder}`;
		}
		return base;
	})();
	$: shouldNoIndex = hasActiveFilters;

	$: pageDescription = aiSummaryEnabled
		? '입법예고 아카이브에서 키워드 검색과 법률안을 조회하고, 원문과 AI 요약을 확인할 수 있습니다.'
		: '입법예고 아카이브에서 키워드 검색과 법률안을 조회하고 원문을 확인할 수 있습니다.';

	let error = '';
	$: if (data) {
		error = data.error || '';
	}

	function toInputDate(date: Date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function addDays(base: Date, amount: number) {
		const dayMillis = 24 * 60 * 60 * 1000;
		return new SvelteDate(base.getTime() + amount * dayMillis);
	}

	const today = new SvelteDate();
	const todayInputDate = toInputDate(today);
	const quickStart7Days = toInputDate(addDays(today, -6));
	const quickStart30Days = toInputDate(addDays(today, -29));
	const quickMonthStart = toInputDate(new SvelteDate(today.getFullYear(), today.getMonth(), 1));
	$: isQuick7DaysActive = startDate === quickStart7Days && endDate === todayInputDate;
	$: isQuick30DaysActive = startDate === quickStart30Days && endDate === todayInputDate;
	$: isQuickThisMonthActive = startDate === quickMonthStart && endDate === todayInputDate;
	$: isQuickClearRangeActive = !startDate.trim() && !endDate.trim();
	$: hasDateReversed =
		startDate.trim().length > 0 && endDate.trim().length > 0 && startDate > endDate;
	$: isServerLoading =
		!!$navigating?.to?.url && $navigating.to.url.pathname.replace(/\/+$/, '') === '/notices';

	let pendingPaginationPage: number | null = null;
	let wasServerLoading = false;

	$: {
		if (wasServerLoading && !isServerLoading) {
			pendingPaginationPage = null;
		}
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
	};

	function buildQueryLink(overrides: QueryLinkOverrides = {}) {
		// Always get the latest $page value for correct query params
		const currentPageStore = get(page);
		let searchParams = new SvelteURLSearchParams(currentPageStore.url.search);
		if (overrides.page !== undefined) searchParams.set('page', String(overrides.page));
		if (overrides.limit !== undefined) searchParams.set('limit', String(overrides.limit));
		if (overrides.search !== undefined) searchParams.set('search', overrides.search.trim());
		if (overrides.startDate !== undefined)
			searchParams.set('startDate', overrides.startDate.trim());
		if (overrides.endDate !== undefined) searchParams.set('endDate', overrides.endDate.trim());
		if (overrides.sortOrder !== undefined) searchParams.set('sortOrder', overrides.sortOrder);
		if ('isDone' in overrides) {
			if (overrides.isDone === null || overrides.isDone === undefined) {
				searchParams.delete('isDone');
			} else {
				searchParams.set('isDone', String(overrides.isDone));
			}
		}
		// 기본값 보장
		if (!searchParams.get('page')) searchParams.set('page', String(currentPage));
		if (!searchParams.get('limit')) searchParams.set('limit', String(limit));
		if (!searchParams.get('sortOrder')) searchParams.set('sortOrder', sortOrder);
		return `/notices?${searchParams.toString()}`;
	}

	function buildFilterLink(overrides: {
		search?: string;
		startDate?: string;
		endDate?: string;
		sortOrder?: 'asc' | 'desc';
		isDone?: boolean | null;
	}) {
		return buildQueryLink({
			page: 1,
			search: overrides.search,
			startDate: overrides.startDate,
			endDate: overrides.endDate,
			sortOrder: overrides.sortOrder,
			...('isDone' in overrides ? { isDone: overrides.isDone } : {})
		});
	}

	function buildPageLink(page: number) {
		return buildQueryLink({ page });
	}

	function getPaginationInfo() {
		if (totalItems === 0) {
			return '0개';
		}

		const start = (currentPage - 1) * limit + 1;
		const end = Math.min(currentPage * limit, totalItems);
		return `${start.toLocaleString('ko-KR')}-${end.toLocaleString('ko-KR')} / ${totalItems.toLocaleString('ko-KR')}개`;
	}

	function shouldShowAIBriefing(notice: (typeof notices)[number]) {
		if (!aiSummaryEnabled) {
			return false;
		}

		return notice.aiSummaryStatus === 'ready' || notice.aiSummaryStatus === 'unavailable';
	}

	// Make pagination items reactive to archive/totalPages/currentPage
	$: paginationItems = (() => {
		if (totalPages <= 7) {
			return Array.from({ length: totalPages }, (_, idx) => idx + 1);
		}

		const items: Array<number | 'left-ellipsis' | 'right-ellipsis'> = [1];
		let start = Math.max(2, currentPage - 1);
		let end = Math.min(totalPages - 1, currentPage + 1);

		if (currentPage <= 3) {
			start = 2;
			end = 4;
		} else if (currentPage >= totalPages - 2) {
			start = totalPages - 3;
			end = totalPages - 1;
		}

		if (start > 2) {
			items.push('left-ellipsis');
		}

		for (let page = start; page <= end; page++) {
			items.push(page);
		}

		if (end < totalPages - 1) {
			items.push('right-ellipsis');
		}

		items.push(totalPages);
		return items;
	})();

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
		if (search) params.set('search', search);
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		if (sortOrder) params.set('sortOrder', sortOrder);
		goto(`/notices?${params.toString()}`);
	}
</script>

<svelte:head>
	<title
		>전체 입법예고{archiveCount > 0 ? ` (전체 ${archiveCount.toLocaleString('ko-KR')}건)` : ''} - LawCast</title
	>
	<link rel="canonical" href={canonicalUrl} />
	{#if shouldNoIndex}
		<meta name="robots" content="noindex, follow" />
	{/if}
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

<div class="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<nav class="mb-8 flex items-center space-x-3 text-sm" aria-label="이동 경로">
			<a
				href="../"
				class="flex items-center rounded-lg border border-gray-200/50 bg-white/90 px-3 py-2 text-gray-600 shadow-sm transition-all duration-200 hover:bg-white hover:text-gray-800"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				메인으로
			</a>
			<span class="text-gray-400" aria-hidden="true">/</span>
			<span class="font-semibold text-gray-700">전체 입법예고</span>
		</nav>

		{#if aiSummaryEnabled}
			<div
				class="mb-6 rounded-xl border border-amber-200/80 bg-linear-to-r from-amber-50 to-orange-50 p-4 shadow-sm"
			>
				<div class="flex items-start gap-3">
					<div class="mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700">
						<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
					</div>
					<div>
						<p class="text-sm font-semibold text-amber-900">안내</p>
						<p class="mt-1 text-sm leading-relaxed text-amber-800/90">
							AI 요약은 참고용으로 제공되며 해석상 오류가 있을 수 있습니다. 중요 판단 전 반드시 각
							법률안의 원문(제안이유 및 주요내용)을 함께 확인해주세요.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<div
			class="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
			role="status"
			aria-live="polite"
		>
			<p class="text-sm font-medium text-slate-600">
				{hasActiveFilters ? '현재 검색 결과' : '입법예고 아카이브 건수'}
			</p>
			<p class="text-lg font-bold text-slate-900">
				{#if hasActiveFilters}
					{totalItems.toLocaleString('ko-KR')}건
					<span class="ml-1 text-sm font-medium text-slate-500"
						>/ 전체 {archiveCount.toLocaleString('ko-KR')}건</span
					>
				{:else}
					{archiveCount.toLocaleString('ko-KR')}건
				{/if}
			</p>
		</div>

		{#if error}
			<Alert type="error" message={error} dismissible={false} />
		{:else}
			<form
				method="GET"
				action="/notices"
				class="mb-5"
				class:pointer-events-none={isServerLoading}
				class:opacity-80={isServerLoading}
				aria-busy={isServerLoading}
				on:submit|preventDefault={handleFilterSubmit}
			>
				<div class="mb-2 flex flex-wrap items-center gap-2">
					<span class="text-xs font-semibold text-slate-500">빠른 기간</span>
					<a
						href={buildFilterLink({ startDate: quickStart7Days, endDate: todayInputDate })}
						class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
							isQuick7DaysActive
								? 'border-blue-300 bg-blue-50 text-blue-700'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						최근 7일
					</a>
					<a
						href={buildFilterLink({ startDate: quickStart30Days, endDate: todayInputDate })}
						class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
							isQuick30DaysActive
								? 'border-blue-300 bg-blue-50 text-blue-700'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						최근 30일
					</a>
					<a
						href={buildFilterLink({ startDate: quickMonthStart, endDate: todayInputDate })}
						class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
							isQuickThisMonthActive
								? 'border-blue-300 bg-blue-50 text-blue-700'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						이번 달
					</a>
					<a
						href={buildFilterLink({ startDate: '', endDate: '' })}
						class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
							isQuickClearRangeActive
								? 'border-blue-300 bg-blue-50 text-blue-700'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
					>
						기간 해제
					</a>
					<span class="hidden h-4 w-px bg-slate-200 sm:block"></span>
					<div
						class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold"
						role="group"
						aria-label="입법예고 상태 필터"
					>
						<a
							href={buildQueryLink({ page: 1, isDone: null })}
							class={`rounded-full px-3 py-1 transition-colors ${
								isDoneFilter === undefined
									? 'bg-white text-slate-800 shadow-sm'
									: 'text-slate-500 hover:text-slate-700'
							}`}
						>
							전체
						</a>
						<a
							href={buildQueryLink({ page: 1, isDone: false })}
							class={`rounded-full px-3 py-1 transition-colors ${
								isDoneFilter === false
									? 'bg-emerald-500 text-white shadow-sm'
									: 'text-slate-500 hover:text-slate-700'
							}`}
						>
							진행 중
						</a>
						<a
							href={buildQueryLink({ page: 1, isDone: isDoneFilter === true ? null : true })}
							class={`rounded-full px-3 py-1 transition-colors ${
								isDoneFilter === true
									? 'bg-gray-400 text-white shadow-sm'
									: 'text-slate-500 hover:text-slate-700'
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
							class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
						/>
						<input
							id="archive-search"
							type="text"
							name="search"
							value={searchQuery}
							placeholder="법률안명, 소관위원회, 원문 키워드 검색"
							class="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-10 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
						/>
					</div>
					<label for="archive-start-date" class="sr-only">시작일</label>
					<input
						id="archive-start-date"
						type="date"
						name="startDate"
						value={startDate}
						max={endDate || undefined}
						class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
						title="시작일"
					/>
					<label for="archive-end-date" class="sr-only">종료일</label>
					<input
						id="archive-end-date"
						type="date"
						name="endDate"
						value={endDate}
						min={startDate || undefined}
						class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
						title="종료일"
					/>
					<label for="archive-sort-order" class="sr-only">정렬</label>
					<select
						id="archive-sort-order"
						name="sortOrder"
						value={sortOrder}
						class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
					>
						<option value="desc">내림차순</option>
						<option value="asc">오름차순</option>
					</select>
					<input type="hidden" name="page" value="1" />
					<input type="hidden" name="limit" value={String(limit)} />
				</div>
				{#if hasDateReversed}
					<p class="mt-2 text-xs font-medium text-amber-700">
						시작일이 종료일보다 늦습니다. 검색 시 서버에서 자동으로 범위를 보정합니다.
					</p>
				{/if}
				{#if hasActiveFilters}
					<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
						<span class="font-semibold text-slate-500">적용된 필터</span>
						{#if searchQuery.trim()}
							<span
								class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700"
							>
								키워드: {searchQuery.trim()}
								<a
									href={buildFilterLink({ search: '' })}
									class="ml-2 text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
								>
									해제
								</a>
							</span>
						{/if}
						{#if startDate.trim() || endDate.trim()}
							<span
								class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700"
							>
								기간: {startDate || '처음'} ~ {endDate || '현재'}
								<a
									href={buildFilterLink({ startDate: '', endDate: '' })}
									class="ml-2 text-emerald-700 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-900"
								>
									해제
								</a>
							</span>
						{/if}
						{#if isDoneFilter !== undefined}
							<span
								class={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
									isDoneFilter ? 'bg-gray-200 text-gray-700' : 'bg-emerald-50 text-emerald-700'
								}`}
							>
								{#if isDoneFilter}
									<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
									종료된 입법예고만
								{:else}
									<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
									진행 중인 입법예고만
								{/if}
								<a
									href={buildQueryLink({ page: 1, isDone: null })}
									class="ml-1 opacity-60 hover:opacity-100"
									aria-label="상태 필터 해제"
								>
									✕
								</a>
							</span>
						{/if}
						<span
							class="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700"
						>
							정렬: {sortOrder === 'asc' ? '오름차순' : '내림차순'}
							{#if sortOrder !== 'desc'}
								<a
									href={buildFilterLink({ sortOrder: 'desc' })}
									class="ml-2 text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
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
						class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
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
						class="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
					>
						필터 초기화
					</a>
				</div>
				{#if isServerLoading}
					<div
						class="mt-3 h-1 w-full overflow-hidden rounded-full bg-blue-100"
						role="status"
						aria-live="polite"
					>
						<span class="sr-only">불러오는 중...</span>
						<div class="loading-slide h-full w-1/3 rounded-full bg-blue-500"></div>
					</div>
				{/if}
			</form>

			<div class="relative">
				{#if notices.length === 0}
					<div
						class="rounded-2xl border border-gray-200/50 bg-linear-to-br from-gray-50 to-blue-50/30 p-16 text-center shadow-xl"
					>
						<div
							class="mb-6 inline-block rounded-full bg-linear-to-r from-gray-200 to-blue-200 p-6"
						>
							<FontAwesomeIcon icon={faBell} class="h-16 w-16 text-gray-400" />
						</div>
						<h3 class="mb-3 text-2xl font-bold text-gray-800">
							{hasActiveFilters ? '검색 결과가 없습니다' : '입법예고가 없습니다'}
						</h3>
						{#if hasActiveFilters}
							<p class="text-sm text-gray-600">다른 키워드로 다시 검색해보세요.</p>
						{/if}
					</div>
				{:else}
					<div class="space-y-4" class:opacity-85={isServerLoading}>
						{#each notices as notice (notice.num)}
							<article
								aria-labelledby="notice-heading-{notice.num}"
								class={`rounded-lg border-l-4 bg-white p-4 shadow transition-shadow hover:shadow-md sm:p-6 ${
									notice.isDone ? 'border-l-gray-300 bg-gray-50/60' : 'border-l-emerald-400'
								}`}
							>
								<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
									<div class="min-w-0 flex-1">
										<div class="mb-3 flex flex-wrap items-center gap-2">
											<span
												class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
											>
												의안번호 {notice.num}
											</span>
											{#if notice.isDone}
												<span
													class="inline-flex items-center gap-1 rounded-md bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-600"
												>
													<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
													입법예고 종료
												</span>
											{:else}
												<span
													class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
												>
													<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
													진행 중
												</span>
											{/if}
										</div>

										<h3
											class={`mb-3 text-lg leading-tight font-semibold wrap-break-word ${notice.isDone ? 'text-gray-500' : 'text-gray-900'}`}
										>
											<a
												href={`/notices/${notice.num}?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&sortOrder=${sortOrder}`}
												class={`no-underline transition-colors duration-150 ${notice.isDone ? 'hover:text-gray-600' : 'hover:text-blue-600'}`}
											>
												{notice.subject}
											</a>
										</h3>

										<div class="flex flex-wrap gap-4 text-sm text-gray-600">
											<div class="flex items-center">
												<FontAwesomeIcon icon={faCalendar} class="mr-1 h-4 w-4" />
												제안자 구분: {notice.proposerCategory}
											</div>
											<div class="flex items-center">
												<FontAwesomeIcon icon={faBell} class="mr-1 h-4 w-4" />
												소관위원회: {notice.committee}
											</div>
										</div>

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
											class="inline-flex items-center rounded-md bg-cyan-50 px-2.5 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 hover:text-cyan-800"
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
														class="cursor-pointer rounded-md bg-red-50 p-2.5 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
													>
														<FontAwesomeIcon icon={faFileText} class="h-5 w-5" />
													</button>
												{/if}
												{#if isDownloadable(notice.attachments.hwpFile)}
													<button
														on:click={() =>
															downloadFile(notice.attachments.hwpFile, `${notice.num}.hwp`)}
														aria-label="HWP 다운로드"
														class="cursor-pointer rounded-md bg-blue-50 p-2.5 text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
													>
														<FontAwesomeIcon icon={faFileDownload} class="h-5 w-5" />
													</button>
												{/if}
												<div class="hidden h-6 w-px bg-gray-200 sm:block"></div>
											</div>
										{/if}
										<button
											on:click={() => openExternalLink(notice.link)}
											aria-label="자세히 보기 (새 탭)"
											class="cursor-pointer rounded-md bg-gray-50 p-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700"
										>
											<FontAwesomeIcon icon={faExternalLink} class="h-5 w-5" />
										</button>
									</div>
								</div>
							</article>
						{/each}
					</div>

					{#if totalPages > 1 && totalItems > limit}
						<nav
							class="mt-12 flex flex-wrap items-center justify-center gap-2 px-2"
							aria-label="페이지 내비게이션"
						>
							{#if currentPage > 1}
								<a
									href={buildPageLink(1)}
									on:click={(event) => handlePaginationClick(event, 1)}
									aria-label="첫 페이지로 이동"
									title="첫 페이지"
									class="rounded-xl border-2 border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md sm:px-4 sm:py-3 sm:text-sm"
								>
									{#if pendingPaginationPage === 1}
										<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
									{:else}
										<FontAwesomeIcon icon={faAnglesLeft} class="h-4 w-4" />
									{/if}
								</a>
							{:else}
								<span
									aria-hidden="true"
									class="rounded-xl border-2 border-gray-200 bg-white/60 px-3 py-2 text-xs font-semibold text-gray-400 opacity-60 sm:px-4 sm:py-3 sm:text-sm"
								>
									<FontAwesomeIcon icon={faAnglesLeft} class="h-4 w-4" />
								</span>
							{/if}
							{#if currentPage > 1}
								<a
									href={buildPageLink(currentPage - 1)}
									on:click={(event) => handlePaginationClick(event, currentPage - 1)}
									aria-label="이전 페이지로 이동"
									title="이전 페이지"
									class="rounded-xl border-2 border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md sm:px-4 sm:py-3 sm:text-sm"
								>
									{#if pendingPaginationPage === currentPage - 1}
										<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
									{:else}
										<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
									{/if}
								</a>
							{:else}
								<span
									aria-hidden="true"
									class="rounded-xl border-2 border-gray-200 bg-white/60 px-3 py-2 text-xs font-semibold text-gray-400 opacity-60 sm:px-4 sm:py-3 sm:text-sm"
								>
									<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
								</span>
							{/if}

							{#each paginationItems as item, idx (`${item}-${idx}`)}
								{#if typeof item === 'number'}
									<a
										href={buildPageLink(item)}
										on:click={(event) => handlePaginationClick(event, item)}
										class={`rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-all duration-200 hover:shadow-md sm:px-4 sm:py-3 sm:text-sm ${
											currentPage === item
												? 'scale-105 bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/50'
												: 'border-2 border-gray-200 bg-white/90 text-gray-600 hover:border-blue-200 hover:bg-white hover:text-blue-600'
										}`}
									>
										{#if pendingPaginationPage === item}
											<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
										{:else}
											{item}
										{/if}
									</a>
								{:else}
									<span class="px-1 text-xs font-semibold text-gray-400 sm:px-2 sm:text-sm"
										>...</span
									>
								{/if}
							{/each}
							{#if currentPage < totalPages}
								<a
									href={buildPageLink(currentPage + 1)}
									on:click={(event) => handlePaginationClick(event, currentPage + 1)}
									aria-label="다음 페이지로 이동"
									title="다음 페이지"
									class="rounded-xl border-2 border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md sm:px-4 sm:py-3 sm:text-sm"
								>
									{#if pendingPaginationPage === currentPage + 1}
										<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
									{:else}
										<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
									{/if}
								</a>
							{:else}
								<span
									aria-hidden="true"
									class="rounded-xl border-2 border-gray-200 bg-white/60 px-3 py-2 text-xs font-semibold text-gray-400 opacity-60 sm:px-4 sm:py-3 sm:text-sm"
								>
									<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
								</span>
							{/if}
							{#if currentPage < totalPages}
								<a
									href={buildPageLink(totalPages)}
									on:click={(event) => handlePaginationClick(event, totalPages)}
									aria-label="마지막 페이지로 이동"
									title="마지막 페이지"
									class="rounded-xl border-2 border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md sm:px-4 sm:py-3 sm:text-sm"
								>
									{#if pendingPaginationPage === totalPages}
										<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
									{:else}
										<FontAwesomeIcon icon={faAnglesRight} class="h-4 w-4" />
									{/if}
								</a>
							{:else}
								<span
									aria-hidden="true"
									class="rounded-xl border-2 border-gray-200 bg-white/60 px-3 py-2 text-xs font-semibold text-gray-400 opacity-60 sm:px-4 sm:py-3 sm:text-sm"
								>
									<FontAwesomeIcon icon={faAnglesRight} class="h-4 w-4" />
								</span>
							{/if}
						</nav>

						<div class="mt-6 text-center">
							<span
								class="inline-flex items-center rounded-full bg-linear-to-r from-gray-100 to-blue-100 px-4 py-2 text-sm font-semibold text-gray-700"
							>
								{getPaginationInfo()}
							</span>
						</div>
					{/if}
				{/if}

				{#if isServerLoading}
					<div class="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-white/35"></div>
					<div
						class="pointer-events-none absolute top-3 right-3 z-20 inline-flex items-center rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm"
						role="status"
						aria-live="polite"
					>
						<FontAwesomeIcon icon={faSpinner} class="mr-1.5 h-3.5 w-3.5 animate-spin" />
						불러오는 중
					</div>
				{/if}
			</div>
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
