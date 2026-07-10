<script lang="ts">
	import { slide } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faCodeCompare, faRotate } from '@fortawesome/free-solid-svg-icons';
	import NoticeRevisionCompare from '$lib/components/NoticeRevisionCompare.svelte';
	import type { NoticeChangeTimelineResponse } from '$lib/types/api';
	import { NoticeChangeSource } from '$lib/types/change-source';
	import { formatDateTimeKST } from '$lib/utils/helpers';

	export let isOpen = false;
	export let changes: NoticeChangeTimelineResponse;
	export let activeRevisionForUi: number | null;
	export let buildRevisionLink: (rev: number | null) => string;
	export let isCompareMode: boolean;
	export let selectedFromRev: number | null;
	export let selectedToRev: number | null;
	export let showAllCompareFields: boolean;
	export let clearCompareHref: string;
	export let onToggleCompareShowAll: () => Promise<void> | void;
	export let revisionDiffItems: {
		fieldPath: string;
		fieldLabel: string;
		changeType: 'added' | 'removed' | 'modified' | 'unchanged';
		beforeValue: string | null;
		afterValue: string | null;
	}[];
	export let canSelectCompareBase: boolean;
	export let onSelectCompare: (
		fromRev: number | null,
		toRev: number | null
	) => Promise<void> | void;

	function eventTypeLabel(eventType: string): string {
		switch (eventType) {
			case 'created':
				return '신규 법률안 생성';
			case 'updated':
				return '법률안 갱신';
			case 'invalidated':
				return '법률안 무효화';
			default:
				return eventType;
		}
	}

	function eventTypeChipClass(eventType: string): string {
		switch (eventType) {
			case 'created':
				return 'lc-chip-blue';
			case 'updated':
				return 'lc-chip-success';
			case 'invalidated':
				return 'lc-chip-warning';
			default:
				return 'lc-chip-muted';
		}
	}

	function isEmphasisEvent(eventType: string): boolean {
		return eventType === 'invalidated';
	}

	function toReadableSourceLabel(source: string | null): string {
		if (!source) {
			return '시스템';
		}

		if (source.includes(NoticeChangeSource.ARCHIVE_UPSERT)) return '아카이브 저장';
		if (source.includes(NoticeChangeSource.ARCHIVE_RENUMBERED))
			return '의안번호 변경(기존 번호 무효화)';
		if (source.includes(NoticeChangeSource.ARCHIVE_SOURCE_MISSING)) return '소스 미존재 처리(보존)';
		if (source.includes(NoticeChangeSource.ARCHIVE_UPDATE_SOURCE_HTML)) return '원문 HTML 갱신';
		if (source.includes(NoticeChangeSource.ARCHIVE_IS_DONE_SYNC)) return '처리 상태 동기화';
		if (source.includes(NoticeChangeSource.ARCHIVE_UPDATE_NSM_HTML_AND_DETAIL))
			return '국회 원문/상세 동기화';
		if (source.includes(NoticeChangeSource.BOOTSTRAP_LEGACY_SEED)) return '제네시스 시드 생성';

		return source;
	}

	function shortenHash(hash: string): string {
		if (!hash) {
			return 'N/A';
		}

		if (hash.length <= 20) {
			return hash;
		}

		return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
	}
</script>

<details bind:open={isOpen} class="lc-panel-card mb-6 rounded-2xl border p-6 shadow-sm">
	<summary
		class="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition-colors duration-200 hover:bg-(--lc-surface-hover)"
	>
		<span class="flex items-center gap-2">
			<FontAwesomeIcon icon={faCodeCompare} class="lc-text-accent h-5 w-5" />
			<h2 class="lc-text-primary text-lg font-bold">변경 추적 타임라인</h2>
		</span>
		<span
			class="lc-button-neutral inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200"
		>
			<span class="inline-flex transition-transform duration-200" class:rotate-180={isOpen}>
				<FontAwesomeIcon icon={faChevronDown} class="h-4 w-4" />
			</span>
		</span>
	</summary>

	{#if isOpen}
		<div class="mt-4" in:slide={{ duration: 220 }} out:slide={{ duration: 160 }}>
			<NoticeRevisionCompare
				{isCompareMode}
				{selectedFromRev}
				{selectedToRev}
				{showAllCompareFields}
				{clearCompareHref}
				{onToggleCompareShowAll}
				{revisionDiffItems}
			/>

			{#if changes.items.length === 0}
				<div class="lc-panel-inset rounded-lg border px-4 py-5 text-sm">
					아직 기록된 변경 이벤트가 없습니다.
				</div>
			{:else}
				<div class="space-y-3">
					{#each changes.items as event (event.id)}
						<div
							class={`lc-panel-inset overflow-hidden rounded-xl border px-4 py-3 ${isEmphasisEvent(event.eventType) ? 'lc-banner-warning' : ''}`}
						>
							<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
								<div class="min-w-0 space-y-1">
									<div class="flex flex-wrap items-center gap-2">
										<span
											class="lc-chip-blue inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
										>
											<FontAwesomeIcon icon={faRotate} class="mr-1.5 h-3 w-3" />
											Rev #{event.eventHeight}
										</span>
										<span
											class={`${eventTypeChipClass(event.eventType)} inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold`}
										>
											{eventTypeLabel(event.eventType)}
										</span>
										{#if event.eventHeight === activeRevisionForUi}
											<span
												class="lc-chip-success inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
											>
												현재 리비전
											</span>
										{:else}
											<a
												href={buildRevisionLink(event.eventHeight)}
												class="lc-button-neutral inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold hover:cursor-pointer"
											>
												리비전 보기
											</a>
										{/if}
										{#if canSelectCompareBase}
											{#if selectedFromRev === null}
												<button
													type="button"
													on:click={() => onSelectCompare(event.eventHeight, null)}
													class="lc-button-neutral inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold hover:cursor-pointer"
												>
													기준으로 선택
												</button>
											{:else if selectedFromRev !== event.eventHeight}
												<button
													type="button"
													on:click={() => onSelectCompare(selectedFromRev, event.eventHeight)}
													class="lc-button-neutral inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold hover:cursor-pointer"
												>
													비교 대상으로 선택
												</button>
											{:else}
												<span
													class="lc-chip-muted inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
												>
													비교 기준
												</span>
											{/if}
										{/if}
									</div>
									<p
										class="lc-text-secondary flex flex-wrap items-center gap-1.5 text-xs leading-relaxed wrap-break-word"
									>
										<span>{formatDateTimeKST(event.detectedAt)}</span>
										<span aria-hidden="true">·</span>
										<span class="min-w-0 break-all">{toReadableSourceLabel(event.source)}</span>
										<span aria-hidden="true">·</span>
										<span class="lc-text-muted">hash</span>
										<span
											class="lc-inline-code rounded px-1 py-0.5 font-mono break-all"
											title={event.eventHash}
										>
											{shortenHash(event.eventHash)}
										</span>
									</p>
								</div>
								<div class="lc-text-secondary shrink-0 text-xs">
									필드 {event.changedFieldCount}개 변경
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</details>
