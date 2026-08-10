<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faAnglesLeft,
		faAnglesRight,
		faArrowLeft,
		faChevronLeft,
		faChevronRight,
		faCircleInfo,
		faCodeCompare,
		faFileCircleXmark,
		faMagnifyingGlass,
		faRotate,
		faSpinner,
		faSquarePollHorizontal,
		faTableList
	} from '@fortawesome/free-solid-svg-icons';
	import type {
		ChangeEventType,
		ComparableChangeSummary,
		RecentNoticeChangesResponse
	} from '$lib/types/api';
	import { NoticeChangeSource } from '$lib/types/change-source';
	import { formatDateTimeKST } from '$lib/utils/helpers';

	export let data: {
		changes: RecentNoticeChangesResponse;
		summary: ComparableChangeSummary;
		filters: {
			search: string;
			noticeNum: number | null;
			eventType: ChangeEventType | null;
			source: string;
			sortOrder: 'asc' | 'desc';
			includeIsDoneChanges: boolean;
		};
		digestContext: {
			isDigestContext: boolean;
			fromEventId: number | null;
			toEventId: number | null;
			fromDetectedAt: string | null;
			toDetectedAt: string | null;
		};
	};

	$: changes = data.changes;
	$: summary = data.summary;
	$: filters = data.filters;
	$: digestContext = data.digestContext;
	$: currentPage = changes.page || 1;
	$: totalPages = changes.totalPages || 1;
	$: totalItems = changes.total || 0;
	$: limit = changes.limit || 10;
	$: isDigestContext = digestContext?.isDigestContext === true;
	$: searchQuery = filters?.search || '';
	$: noticeNumFilter = filters?.noticeNum ?? null;
	$: selectedEventType = filters?.eventType ?? null;
	$: sourceFilter = filters?.source || '';
	$: sortOrder = filters?.sortOrder === 'asc' ? 'asc' : 'desc';
	$: includeIsDoneChanges = filters?.includeIsDoneChanges === true;
	$: hasActiveFilters =
		searchQuery.trim().length > 0 ||
		noticeNumFilter !== null ||
		selectedEventType !== null ||
		sourceFilter.trim().length > 0 ||
		sortOrder === 'asc' ||
		includeIsDoneChanges === false;

	let pendingPaginationPage: number | null = null;

	$: if (pendingPaginationPage === currentPage) {
		pendingPaginationPage = null;
	}

	function eventTypeLabel(eventType: string, source: string | null): string {
		switch (eventType) {
			case 'updated':
				return '내용 변경';
			case 'invalidated':
				if (source?.includes(NoticeChangeSource.ARCHIVE_SOURCE_MISSING)) {
					return '삭제됨';
				}
				if (source?.includes(NoticeChangeSource.ARCHIVE_RENUMBERED)) {
					return '번호 변경 무효화';
				}
				return '무효화';
			default:
				return eventType;
		}
	}

	function eventTypeChipClass(eventType: string, source: string | null): string {
		switch (eventType) {
			case 'updated':
				return 'lc-chip-success';
			case 'invalidated':
				if (source?.includes(NoticeChangeSource.ARCHIVE_RENUMBERED)) {
					return 'lc-chip-muted';
				}
				return 'lc-chip-warning';
			default:
				return 'lc-chip-blue';
		}
	}

	function buildNoticeTimelineHref(noticeNum: number): string {
		return `/notices/${noticeNum}?timeline=true`;
	}

	type FilterOverrides = {
		search?: string;
		noticeNum?: number | null;
		eventType?: ChangeEventType | null;
		source?: string;
		sortOrder?: 'asc' | 'desc';
		includeIsDoneChanges?: boolean;
	};

	function buildPageHref(page: number, overrides: FilterOverrides = {}): string {
		const safePage = Math.max(1, page);
		const resolvedSearch = (overrides.search ?? searchQuery).trim();
		const resolvedNoticeNum = overrides.noticeNum ?? noticeNumFilter;
		const resolvedEventType = overrides.eventType ?? selectedEventType;
		const resolvedSource = (overrides.source ?? sourceFilter).trim();
		const resolvedSortOrder = overrides.sortOrder ?? sortOrder;
		const resolvedIncludeIsDoneChanges = overrides.includeIsDoneChanges ?? includeIsDoneChanges;

		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const params = new URLSearchParams();
		params.set('page', String(safePage));
		params.set('limit', String(changes.limit));
		params.set('sortOrder', resolvedSortOrder);

		if (resolvedSearch.length > 0) {
			params.set('search', resolvedSearch);
		}

		if (resolvedNoticeNum && resolvedNoticeNum > 0) {
			params.set('noticeNum', String(resolvedNoticeNum));
		}

		if (resolvedEventType) {
			params.set('eventType', resolvedEventType);
		}

		if (resolvedSource.length > 0) {
			params.set('source', resolvedSource);
		}

		if (!resolvedIncludeIsDoneChanges) {
			params.set('includeIsDoneChanges', '0');
		}

		if (digestContext?.fromEventId) {
			params.set('fromEventId', String(digestContext.fromEventId));
		}

		if (digestContext?.toEventId) {
			params.set('toEventId', String(digestContext.toEventId));
		}

		if (digestContext?.fromDetectedAt) {
			params.set('fromDetectedAt', digestContext.fromDetectedAt);
		}

		if (digestContext?.toDetectedAt) {
			params.set('toDetectedAt', digestContext.toDetectedAt);
		}

		if (isDigestContext) {
			params.set('digest', '1');
		}

		return `/notices/changes?${params.toString()}`;
	}

	function isDigestMatchedItem(item: (typeof changes.items)[number]): boolean {
		if (!isDigestContext) {
			return false;
		}

		if (digestContext.fromEventId && item.id < digestContext.fromEventId) {
			return false;
		}

		if (digestContext.toEventId && item.id > digestContext.toEventId) {
			return false;
		}

		const detectedAtEpoch = Date.parse(item.detectedAt);
		if (Number.isFinite(detectedAtEpoch)) {
			if (digestContext.fromDetectedAt) {
				const fromEpoch = Date.parse(digestContext.fromDetectedAt);
				if (Number.isFinite(fromEpoch) && detectedAtEpoch < fromEpoch) {
					return false;
				}
			}

			if (digestContext.toDetectedAt) {
				const toEpoch = Date.parse(digestContext.toDetectedAt);
				if (Number.isFinite(toEpoch) && detectedAtEpoch > toEpoch) {
					return false;
				}
			}
		}

		return true;
	}

	$: digestMatchedCount = changes.items.filter((item) => isDigestMatchedItem(item)).length;

	function getPaginationInfo() {
		if (totalItems === 0) {
			return '0개';
		}

		const start = (currentPage - 1) * limit + 1;
		const end = Math.min(currentPage * limit, totalItems);
		return `${start.toLocaleString('ko-KR')}-${end.toLocaleString('ko-KR')} / ${totalItems.toLocaleString('ko-KR')}개`;
	}

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
		goto(buildPageHref(targetPage));
	}

	function handleFilterSubmit(event: Event) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);
		const search = (formData.get('search') || '').toString().trim();
		const noticeNumRaw = (formData.get('noticeNum') || '').toString().trim();
		const parsedNoticeNum = Number.parseInt(noticeNumRaw, 10);
		const noticeNum =
			Number.isInteger(parsedNoticeNum) && parsedNoticeNum > 0 ? parsedNoticeNum : null;
		const eventTypeRaw = (formData.get('eventType') || '').toString().trim();
		const eventType =
			eventTypeRaw === 'updated' || eventTypeRaw === 'invalidated'
				? (eventTypeRaw as ChangeEventType)
				: null;
		const source = (formData.get('source') || '').toString().trim();
		const nextSortOrder = formData.get('sortOrder') === 'asc' ? 'asc' : 'desc';
		const nextIncludeIsDoneChanges = formData.get('includeIsDoneChanges') === 'true';

		goto(
			buildPageHref(1, {
				search,
				noticeNum,
				eventType,
				source,
				sortOrder: nextSortOrder,
				includeIsDoneChanges: nextIncludeIsDoneChanges
			})
		);
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

		event.preventDefault();
		form.requestSubmit();
	}
</script>

<svelte:head>
	<title>변경 내역 모아보기 - LawCast</title>
	<meta
		name="description"
		content="처음 등록된 기록을 제외하고 실제로 달라진 내용만 모아 보여줍니다."
	/>
</svelte:head>

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
		<nav class="mt-6 mb-6 flex items-center gap-2 text-sm" aria-label="이동 경로">
			<a href="/" class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2">
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-3.5 w-3.5" />
				홈으로
			</a>
			<a
				href="/notices"
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2"
			>
				<FontAwesomeIcon icon={faTableList} class="mr-2 h-3.5 w-3.5" />
				전체 목록
			</a>
		</nav>

		<section class="lc-panel-card mb-6 rounded-2xl border p-6 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 class="lc-text-primary inline-flex items-center text-2xl font-bold tracking-tight">
						<FontAwesomeIcon icon={faCodeCompare} class="mr-2 h-4 w-4" />
						변경 내역 모아보기
					</h1>
					<p class="lc-text-secondary mt-1 text-sm">
						처음 등록된 기록을 빼고, 실제로 바뀐 내용만 모아 보여드립니다.
					</p>
				</div>
				<div class="flex flex-wrap gap-2 text-xs font-semibold">
					<span class="lc-chip-blue inline-flex items-center rounded-full px-3 py-1.5">
						<FontAwesomeIcon icon={faSquarePollHorizontal} class="mr-1.5 h-3.5 w-3.5" />
						확인 가능한 변경 내역 {summary.comparableEventTotal.toLocaleString('ko-KR')}건
					</span>
				</div>
			</div>
		</section>

		<div class="lc-banner-muted mb-4 flex items-start rounded-xl border px-4 py-3 text-sm">
			<FontAwesomeIcon icon={faCircleInfo} class="mt-0.5 mr-2 h-4 w-4 shrink-0" />
			<span>
				변경 추적 이력은 <strong>도입 기준 시점</strong> 이후부터 보장됩니다. 그 이전 변경 이력은 복원
				대상에서 제외됩니다.
			</span>
		</div>

		{#if isDigestContext}
			<div class="lc-banner-warning mb-4 flex items-start rounded-xl border px-4 py-3 text-sm">
				<FontAwesomeIcon icon={faCircleInfo} class="mt-0.5 mr-2 h-4 w-4 shrink-0" />
				<span>
					현재 페이지에서
					<strong>{digestMatchedCount.toLocaleString('ko-KR')}건</strong>이 해당 범위와 일치합니다.
				</span>
			</div>
		{/if}

		{#if !isDigestContext}
			<section class="lc-panel-card mb-5 rounded-xl border p-4 shadow-sm">
				<form method="GET" action="/notices/changes" on:submit={handleFilterSubmit}>
					<div class="grid gap-2 md:grid-cols-[1.2fr_0.7fr_0.8fr_0.9fr_auto] md:items-center">
						<div class="relative">
							<label for="changes-search" class="sr-only">검색어</label>
							<FontAwesomeIcon
								icon={faMagnifyingGlass}
								class="lc-text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
							/>
							<input
								id="changes-search"
								type="search"
								name="search"
								value={searchQuery}
								placeholder="의안번호, 제목, 위원회, 제안이유 검색"
								class="lc-input lc-input-focus w-full rounded-lg border py-2 pr-3 pl-10 text-sm shadow-sm"
								on:keydown={handleSearchInputKeydown}
							/>
						</div>

						<div>
							<label for="changes-notice-num" class="sr-only">의안번호</label>
							<input
								id="changes-notice-num"
								type="number"
								name="noticeNum"
								min="1"
								value={noticeNumFilter ?? ''}
								placeholder="의안번호"
								class="lc-input lc-input-focus w-full rounded-lg border px-3 py-2 text-sm shadow-sm"
							/>
						</div>

						<div>
							<label for="changes-event-type" class="sr-only">이벤트 유형</label>
							<select
								id="changes-event-type"
								name="eventType"
								value={selectedEventType ?? ''}
								class="lc-input lc-input-focus w-full rounded-lg border px-3 py-2 text-sm shadow-sm"
							>
								<option value="">전체 유형</option>
								<option value="updated">내용 변경</option>
								<option value="invalidated">무효화</option>
							</select>
						</div>

						<div>
							<label for="changes-sort-order" class="sr-only">정렬</label>
							<select
								id="changes-sort-order"
								name="sortOrder"
								value={sortOrder}
								class="lc-input lc-input-focus w-full rounded-lg border px-3 py-2 text-sm shadow-sm"
							>
								<option value="desc">최신순</option>
								<option value="asc">오래된순</option>
							</select>
						</div>

						<button
							type="submit"
							class="lc-button-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold"
						>
							검색
						</button>
					</div>

					<div class="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
						<div>
							<label for="changes-source" class="sr-only">소스</label>
							<input
								id="changes-source"
								type="text"
								name="source"
								value={sourceFilter}
								placeholder="이벤트 소스 포함 키워드 (선택)"
								class="lc-input lc-input-focus w-full rounded-lg border px-3 py-2 text-sm shadow-sm"
							/>
						</div>

						<label class="inline-flex cursor-pointer items-center gap-2 text-sm">
							<input
								type="checkbox"
								name="includeIsDoneChanges"
								value="true"
								checked={includeIsDoneChanges}
								class="h-4 w-4"
							/>
							<span class="lc-text-secondary">종료된 입법예고 관련 변경도 포함</span>
						</label>

						<a
							href="/notices/changes"
							class="lc-button-neutral inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold"
						>
							필터 초기화
						</a>
					</div>
				</form>

				{#if hasActiveFilters}
					<div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
						<span class="lc-text-muted font-semibold">적용된 필터</span>
						{#if searchQuery.trim()}
							<span
								class="lc-chip-blue inline-flex items-center rounded-full px-2 py-1 font-semibold"
							>
								키워드: {searchQuery.trim()}
							</span>
						{/if}
						{#if noticeNumFilter !== null}
							<span
								class="lc-chip-success inline-flex items-center rounded-full px-2 py-1 font-semibold"
							>
								의안번호: {noticeNumFilter}
							</span>
						{/if}
						{#if selectedEventType !== null}
							<span
								class="lc-chip-muted inline-flex items-center rounded-full px-2 py-1 font-semibold"
							>
								유형: {selectedEventType === 'updated' ? '내용 변경' : '무효화'}
							</span>
						{/if}
						{#if sourceFilter.trim()}
							<span
								class="lc-chip-warning inline-flex items-center rounded-full px-2 py-1 font-semibold"
							>
								소스: {sourceFilter.trim()}
							</span>
						{/if}
						{#if includeIsDoneChanges === false}
							<span
								class="lc-chip-muted inline-flex items-center rounded-full px-2 py-1 font-semibold"
							>
								종료된 입법예고 제외
							</span>
						{/if}
						{#if sortOrder === 'asc'}
							<span
								class="lc-chip-muted inline-flex items-center rounded-full px-2 py-1 font-semibold"
							>
								정렬: 오래된순
							</span>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		{#if changes.items.length === 0}
			<section class="lc-panel-card rounded-2xl border p-8 text-center shadow-sm">
				<FontAwesomeIcon
					icon={faFileCircleXmark}
					class="lc-text-muted mx-auto mb-4 h-10 w-10 text-4xl"
				/>
				<p class="lc-text-secondary text-sm">보여드릴 변경 내역이 없습니다.</p>
			</section>
		{:else}
			<section class="space-y-3">
				{#each changes.items as item (item.id)}
					<article
						class={`lc-panel-card rounded-xl border p-4 shadow-sm ${isDigestMatchedItem(item) ? 'lc-banner-warning border-2' : ''}`}
					>
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="lc-text-primary mb-2 truncate text-sm font-semibold sm:text-base">
									{item.subject?.trim() || '(법률안 제목 정보 없음)'}
								</p>
								<div class="mb-2 flex flex-wrap items-center gap-2">
									<span
										class="lc-chip-blue inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
									>
										<FontAwesomeIcon icon={faRotate} class="mr-1 h-3 w-3" />
										의안번호 {item.noticeNum}
									</span>
									<span
										class={`${eventTypeChipClass(item.eventType, item.source)} inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold`}
									>
										{eventTypeLabel(item.eventType, item.source)}
									</span>
									<span
										class="lc-chip-muted inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
									>
										변경 횟수 {item.eventHeight - 1}회
									</span>
								</div>
								<p class="lc-text-secondary text-xs">
									{formatDateTimeKST(item.detectedAt)} · 바뀐 항목 {item.changedFieldCount}개
								</p>
							</div>
							<a
								href={buildNoticeTimelineHref(item.noticeNum)}
								class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold"
							>
								<FontAwesomeIcon icon={faCodeCompare} class="mr-1.5 h-3.5 w-3.5" />
								변경 내역 보기
							</a>
						</div>
					</article>
				{/each}
			</section>

			{#if totalPages > 1 && totalItems > limit}
				<nav
					class="mt-12 flex flex-wrap items-center justify-center gap-2 px-2"
					aria-label="페이지 내비게이션"
				>
					{#if currentPage > 1}
						<a
							href={buildPageHref(1)}
							on:click={(event) => handlePaginationClick(event, 1)}
							aria-label="첫 페이지로 이동"
							title="첫 페이지"
							class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
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
							class="lc-pagination-disabled rounded-xl border-2 px-3 py-2 text-xs font-semibold opacity-60 sm:px-4 sm:py-3 sm:text-sm"
						>
							<FontAwesomeIcon icon={faAnglesLeft} class="h-4 w-4" />
						</span>
					{/if}

					{#if currentPage > 1}
						<a
							href={buildPageHref(currentPage - 1)}
							on:click={(event) => handlePaginationClick(event, currentPage - 1)}
							aria-label="이전 페이지로 이동"
							title="이전 페이지"
							class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
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
							class="lc-pagination-disabled rounded-xl border-2 px-3 py-2 text-xs font-semibold opacity-60 sm:px-4 sm:py-3 sm:text-sm"
						>
							<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
						</span>
					{/if}

					{#each paginationItems as item, idx (`${item}-${idx}`)}
						{#if typeof item === 'number'}
							<a
								href={buildPageHref(item)}
								on:click={(event) => handlePaginationClick(event, item)}
								class={`rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-all duration-200 hover:shadow-md sm:px-4 sm:py-3 sm:text-sm ${
									currentPage === item
										? 'lc-pagination-active scale-105 border'
										: 'lc-pagination-btn border-2'
								}`}
							>
								{#if pendingPaginationPage === item}
									<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
								{:else}
									{item}
								{/if}
							</a>
						{:else}
							<span class="lc-text-dim px-1 text-xs font-semibold sm:px-2 sm:text-sm">...</span>
						{/if}
					{/each}

					{#if currentPage < totalPages}
						<a
							href={buildPageHref(currentPage + 1)}
							on:click={(event) => handlePaginationClick(event, currentPage + 1)}
							aria-label="다음 페이지로 이동"
							title="다음 페이지"
							class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
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
							class="lc-pagination-disabled rounded-xl border-2 px-3 py-2 text-xs font-semibold opacity-60 sm:px-4 sm:py-3 sm:text-sm"
						>
							<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
						</span>
					{/if}

					{#if currentPage < totalPages}
						<a
							href={buildPageHref(totalPages)}
							on:click={(event) => handlePaginationClick(event, totalPages)}
							aria-label="마지막 페이지로 이동"
							title="마지막 페이지"
							class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
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
							class="lc-pagination-disabled rounded-xl border-2 px-3 py-2 text-xs font-semibold opacity-60 sm:px-4 sm:py-3 sm:text-sm"
						>
							<FontAwesomeIcon icon={faAnglesRight} class="h-4 w-4" />
						</span>
					{/if}
				</nav>

				<div class="mt-6 text-center">
					<span
						class="lc-page-count inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold"
					>
						{getPaginationInfo()}
					</span>
				</div>
			{/if}
		{/if}
	</main>
</div>
