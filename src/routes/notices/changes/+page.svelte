<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faCircleInfo,
		faCodeCompare,
		faFileCircleXmark,
		faRotate,
		faSquarePollHorizontal,
		faTableList
	} from '@fortawesome/free-solid-svg-icons';
	import type { ComparableChangeSummary, RecentNoticeChangesResponse } from '$lib/types/api';

	export let data: {
		changes: RecentNoticeChangesResponse;
		summary: ComparableChangeSummary;
	};

	$: changes = data.changes;
	$: summary = data.summary;

	function eventTypeLabel(eventType: string): string {
		switch (eventType) {
			case 'updated':
				return '내용 변경';
			case 'invalidated':
				return '삭제됨';
			case 'redacted':
				return '일부 숨김';
			case 'created':
				return '처음 등록';
			default:
				return eventType;
		}
	}

	function eventTypeChipClass(eventType: string): string {
		switch (eventType) {
			case 'updated':
				return 'lc-chip-success';
			case 'invalidated':
				return 'lc-chip-warning';
			case 'redacted':
				return 'lc-chip-muted';
			default:
				return 'lc-chip-blue';
		}
	}

	function buildNoticeTimelineHref(noticeNum: number): string {
		return `/notices/${noticeNum}?timeline=true`;
	}

	function buildPageHref(page: number): string {
		const safePage = Math.max(1, page);
		return `/notices/changes?page=${safePage}&limit=${changes.limit}`;
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
					<article class="lc-panel-card rounded-xl border p-4 shadow-sm">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="min-w-0">
								<div class="mb-2 flex flex-wrap items-center gap-2">
									<span
										class="lc-chip-blue inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
									>
										<FontAwesomeIcon icon={faRotate} class="mr-1 h-3 w-3" />
										의안번호 {item.noticeNum}
									</span>
									<span
										class={`${eventTypeChipClass(item.eventType)} inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold`}
									>
										{eventTypeLabel(item.eventType)}
									</span>
									<span
										class="lc-chip-muted inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
									>
										변경 횟수 {item.eventHeight - 1}회
									</span>
								</div>
								<p class="lc-text-secondary text-xs">
									{new Date(item.detectedAt).toLocaleString()} · 바뀐 항목 {item.changedFieldCount}개
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

			{#if changes.totalPages > 1}
				<nav
					class="mt-6 flex flex-wrap items-center justify-center gap-2"
					aria-label="페이지네이션"
				>
					{#if changes.page > 1}
						<a
							href={buildPageHref(changes.page - 1)}
							class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
						>
							이전
						</a>
					{/if}
					<span class="lc-text-secondary px-2 text-sm">
						{changes.page} / {changes.totalPages}
					</span>
					{#if changes.page < changes.totalPages}
						<a
							href={buildPageHref(changes.page + 1)}
							class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
						>
							다음
						</a>
					{/if}
				</nav>
			{/if}
		{/if}
	</main>
</div>
