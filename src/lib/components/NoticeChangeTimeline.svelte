<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faCodeCompare } from '@fortawesome/free-solid-svg-icons';
	import NoticeRevisionCompare from '$lib/components/NoticeRevisionCompare.svelte';
	import type { NoticeChangeTimelineResponse } from '$lib/types/api';
	import { NoticeChangeSource } from '$lib/types/change-source';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import { revisionFieldLabel, type RevisionDiffItem } from '$lib/utils/revision-comparison';

	let {
		isOpen = $bindable(false),
		changes,
		activeRevisionForUi,
		buildRevisionLink,
		isCompareMode,
		selectedFromRev,
		selectedToRev,
		showAllCompareFields,
		onToggleCompareShowAll,
		revisionDiffItems,
		onSelectCompare,
		comparisonPending,
		comparisonError,
		historyError,
		onRetryHistory
	}: {
		isOpen?: boolean;
		changes: NoticeChangeTimelineResponse;
		activeRevisionForUi: number | null;
		buildRevisionLink: (rev: number | null) => string;
		isCompareMode: boolean;
		selectedFromRev: number | null;
		selectedToRev: number | null;
		showAllCompareFields: boolean;
		onToggleCompareShowAll: () => Promise<void> | void;
		revisionDiffItems: RevisionDiffItem[];
		onSelectCompare: (fromRev: number | null, toRev: number | null) => Promise<void> | void;
		comparisonPending: boolean;
		comparisonError: string;
		historyError?: string;
		onRetryHistory: () => Promise<void>;
	} = $props();

	let historyRetrying = $state(false);
	let historyRetryError = $state('');
	async function retryHistory() {
		if (historyRetrying) return;
		historyRetrying = true;
		historyRetryError = '';
		try {
			await onRetryHistory();
		} catch {
			historyRetryError = '다시 시도하지 못했습니다. 잠시 후 다시 시도해주세요.';
		} finally {
			historyRetrying = false;
		}
	}

	let records = $derived([...changes.items].sort((a, b) => b.eventHeight - a.eventHeight));
	let latest = $derived(records[0]);
	let oldest = $derived(records.at(-1));
	let fromRecord = $derived(records.find((record) => record.eventHeight === selectedFromRev));
	let toRecord = $derived(records.find((record) => record.eventHeight === selectedToRev));
	let hasSelection = $derived(selectedFromRev !== null || selectedToRev !== null);

	function eventTypeLabel(eventType: string): string {
		if (eventType === 'created') return '최초 보존';
		if (eventType === 'updated') return '정보 갱신';
		if (eventType === 'invalidated') return '보존 상태 변경';
		return eventType;
	}

	function toReadableSourceLabel(source: string | null): string {
		if (!source) return '시스템';
		if (source.includes(NoticeChangeSource.ARCHIVE_UPSERT)) return '아카이브 저장';
		if (source.includes(NoticeChangeSource.ARCHIVE_RENUMBERED)) return '의안번호 변경';
		if (source.includes(NoticeChangeSource.ARCHIVE_SOURCE_MISSING)) return '원문 미존재 확인';
		if (source.includes(NoticeChangeSource.ARCHIVE_UPDATE_SOURCE_HTML)) return '원문 갱신';
		if (source.includes(NoticeChangeSource.ARCHIVE_IS_DONE_SYNC)) return '처리 상태 동기화';
		if (source.includes(NoticeChangeSource.ARCHIVE_UPDATE_NSM_HTML_AND_DETAIL))
			return '국회 원문·상세 동기화';
		if (source.includes(NoticeChangeSource.BOOTSTRAP_LEGACY_SEED)) return '변경 추적 시작';
		return source;
	}
</script>

<details
	bind:open={isOpen}
	class="lc-panel-card group mb-6 rounded-2xl border p-6 shadow-sm"
	data-testid="revision-history"
>
	<summary
		class="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition-colors duration-200 hover:bg-[var(--lc-surface-hover)]"
		data-testid="revision-history-toggle"
	>
		<span class="flex min-w-0 items-center gap-2">
			<FontAwesomeIcon icon={faCodeCompare} class="lc-text-accent h-5 w-5 shrink-0" />
			<h2 class="lc-text-primary text-lg font-bold">변경 기록</h2>
			<span class="lc-text-muted text-sm"
				>{historyError ? '불러오기 실패' : `${records.length}개`}</span
			>
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
		<div in:slide={{ duration: 240 }} out:slide={{ duration: 180 }}>
			<div in:fade={{ duration: 200 }} out:fade={{ duration: 140 }} class="mt-4 space-y-5">
				<p class="lc-text-secondary text-sm leading-relaxed">
					LawCast가 보존한 기록을 최신순으로 보여드립니다. 기록을 열어 당시 내용을 보거나, 두 기록
					사이에 바뀐 내용을 비교할 수 있습니다.
					<span class="lc-text-muted block mt-1"
						>국회 정보의 수집·보완도 기록에 포함되며, 법률안 자체가 수정되었다는 의미는 아닙니다.</span
					>
				</p>

				{#if oldest && oldest.eventHeight > 1}
					<p
						class="lc-banner-muted rounded-lg border p-3 text-sm"
						data-testid="revision-history-window"
					>
						최근 {records.length}개 기록을 표시하고 있습니다. 비교 결과는 이 목록에서 확인할 수 있는
						항목을 기준으로 합니다.
					</p>
				{/if}

				{#if records.length > 1}
					<section
						class="lc-panel-inset space-y-3 rounded-xl border p-4"
						aria-labelledby="revision-selection-heading"
						aria-busy={comparisonPending}
						data-testid="revision-selection"
					>
						<div class="flex flex-wrap items-center justify-between gap-2">
							<h3 id="revision-selection-heading" class="lc-text-primary font-semibold">
								두 기록 비교하기
							</h3>
							<button
								type="button"
								class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
								disabled={comparisonPending}
								onclick={() => onSelectCompare(records[1].eventHeight, records[0].eventHeight)}
								data-testid="compare-latest">최근 변경 비교</button
							>
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="lc-text-secondary min-w-0 text-sm font-semibold">
								기준 기록
								<select
									class="lc-text-primary mt-1 w-full min-w-0 rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-primary) p-2.5"
									value={selectedFromRev ?? ''}
									disabled={comparisonPending}
									onchange={(event) =>
										onSelectCompare(
											event.currentTarget.value ? Number(event.currentTarget.value) : null,
											selectedToRev
										)}
									data-testid="compare-from-select"
								>
									<option value="">기준으로 삼을 기록 선택</option>
									{#each records as record (record.id)}
										<option
											value={record.eventHeight}
											disabled={record.eventHeight === selectedToRev}
											>기록 #{record.eventHeight} · {formatDateTimeKST(record.detectedAt)}</option
										>
									{/each}
								</select>
							</label>
							<label class="lc-text-secondary min-w-0 text-sm font-semibold">
								대상 기록
								<select
									class="lc-text-primary mt-1 w-full min-w-0 rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-primary) p-2.5"
									value={selectedToRev ?? ''}
									disabled={comparisonPending}
									onchange={(event) =>
										onSelectCompare(
											selectedFromRev,
											event.currentTarget.value ? Number(event.currentTarget.value) : null
										)}
									data-testid="compare-to-select"
								>
									<option value="">바뀐 내용을 확인할 기록 선택</option>
									{#each records as record (record.id)}
										<option
											value={record.eventHeight}
											disabled={record.eventHeight === selectedFromRev}
											>기록 #{record.eventHeight} · {formatDateTimeKST(record.detectedAt)}</option
										>
									{/each}
								</select>
							</label>
						</div>
						<p class="lc-text-secondary text-sm" role="status" data-testid="comparison-status">
							{#if comparisonPending}비교할 기록을 적용하고 있습니다…
							{:else if isCompareMode}기록 #{selectedFromRev}을 기준으로 기록 #{selectedToRev}에서
								달라진 내용을 보여드립니다.
							{:else if selectedFromRev !== null}기준 기록을 선택했습니다. 비교할 대상 기록을
								선택해주세요.
							{:else if selectedToRev !== null}대상 기록을 선택했습니다. 비교의 기준이 될 기록을
								선택해주세요.
							{:else}기준과 대상을 하나씩 선택하거나 ‘최근 변경 비교’를 눌러보세요.{/if}
						</p>
						{#if hasSelection}
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
									disabled={comparisonPending || !isCompareMode}
									onclick={() => onSelectCompare(selectedToRev, selectedFromRev)}
									data-testid="compare-swap">기준·대상 바꾸기</button
								>
								<button
									type="button"
									class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
									disabled={comparisonPending}
									onclick={() => onSelectCompare(null, null)}
									data-testid="compare-clear">비교 해제</button
								>
							</div>
						{/if}
					</section>
				{:else if records.length === 1}
					<p class="lc-panel-inset rounded-lg border p-3 text-sm">
						아직 기록이 하나뿐입니다. 다음 변경이 보존되면 두 기록을 비교할 수 있습니다.
					</p>
				{/if}

				{#if comparisonError && !historyError}
					<p
						role="alert"
						class="lc-banner-warning rounded-lg border p-3 text-sm"
						data-testid="comparison-error"
					>
						{comparisonError}
					</p>
				{/if}

				<NoticeRevisionCompare
					{isCompareMode}
					{selectedFromRev}
					{selectedToRev}
					{showAllCompareFields}
					{onToggleCompareShowAll}
					{revisionDiffItems}
					{comparisonPending}
					fromDate={fromRecord?.detectedAt}
					toDate={toRecord?.detectedAt}
				/>

				{#if historyError}
					<div
						class="lc-banner-warning space-y-2 rounded-lg border p-4"
						role="alert"
						data-testid="revision-history-error"
					>
						<p>{historyRetryError || historyError}</p>
						<button
							type="button"
							class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
							disabled={historyRetrying}
							onclick={retryHistory}
							data-testid="revision-history-retry"
							>{historyRetrying ? '불러오는 중…' : '변경 기록 다시 불러오기'}</button
						>
					</div>
				{:else if records.length === 0}
					<p class="lc-panel-inset rounded-lg border p-4 text-sm">
						아직 보존된 변경 기록이 없습니다.
					</p>
				{:else}
					<h3 class="lc-text-primary font-semibold">
						보존된 기록 <span class="lc-text-muted text-sm font-normal">최신순</span>
					</h3>
					<ol class="lc-timeline" aria-label="보존된 변경 기록" data-testid="revision-records">
						{#each records as record, index (record.id)}
							{@const isFrom = selectedFromRev === record.eventHeight}
							{@const isTo = selectedToRev === record.eventHeight}
							{@const isViewed = activeRevisionForUi === record.eventHeight}
							<li
								class={`lc-timeline-item ${isViewed ? 'lc-timeline-item--active' : ''} ${isFrom ? 'lc-timeline-item--compare-from' : ''} ${isTo ? 'lc-timeline-item--compare-to' : ''}`}
								data-testid={`revision-record-${record.eventHeight}`}
							>
								<div class="lc-timeline-dot" aria-hidden="true"></div>
								<div class="lc-panel-inset space-y-3 rounded-xl border p-4">
									<div class="flex flex-wrap items-center gap-2">
										<h4 class="lc-text-primary font-semibold">기록 #{record.eventHeight}</h4>
										<span
											class={`${record.eventType === 'invalidated' ? 'lc-chip-warning' : 'lc-chip-muted'} rounded-full px-2 py-1 text-xs`}
											>{eventTypeLabel(record.eventType)}</span
										>
										{#if record.eventHeight === latest?.eventHeight}<span
												class="lc-chip-success rounded-full px-2 py-1 text-xs">최신 기록</span
											>{/if}
										{#if isViewed}<span class="lc-chip-blue rounded-full px-2 py-1 text-xs"
												>열람 중</span
											>{/if}
										{#if isFrom}<span class="lc-chip-blue rounded-full px-2 py-1 text-xs"
												>비교 기준</span
											>{/if}
										{#if isTo}<span class="lc-chip-success rounded-full px-2 py-1 text-xs"
												>비교 대상</span
											>{/if}
									</div>
									<p class="lc-text-secondary text-sm">
										<time datetime={record.detectedAt}>{formatDateTimeKST(record.detectedAt)}</time>
									</p>
									<p
										class="lc-text-secondary text-sm"
										data-testid={`revision-fields-${record.eventHeight}`}
									>
										{[
											...new Set(
												record.details.map((detail) => revisionFieldLabel(detail.fieldPath))
											)
										].join(' · ') || '보존 정보 갱신'}
									</p>
									<div class="flex flex-wrap gap-2">
										<a
											href={buildRevisionLink(record.eventHeight)}
											aria-current={isViewed ? 'page' : undefined}
											class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
											aria-label={`이 기록 열람: 기록 #${record.eventHeight}`}
											data-testid={`revision-view-${record.eventHeight}`}>이 기록 열람</a
										>
										{#if records[index + 1]}
											<button
												type="button"
												class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
												disabled={comparisonPending}
												onclick={() =>
													onSelectCompare(records[index + 1].eventHeight, record.eventHeight)}
												aria-label={`기록 #${record.eventHeight}을 이전 기록과 비교`}
												data-testid={`revision-previous-${record.eventHeight}`}
												>이전 기록과 비교</button
											>
										{/if}
										{#if records.length > 1}
											<button
												type="button"
												aria-pressed={isFrom}
												class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
												disabled={comparisonPending || isTo}
												onclick={() =>
													onSelectCompare(isFrom ? null : record.eventHeight, selectedToRev)}
												aria-label={`기록 #${record.eventHeight} ${isFrom ? '기준 선택됨' : '기준으로 선택'}`}
												data-testid={`revision-base-${record.eventHeight}`}
												>{isFrom ? '기준 선택됨' : '기준으로 선택'}</button
											>
											{#if selectedFromRev !== null && !isFrom}
												<button
													type="button"
													aria-pressed={isTo}
													class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
													disabled={comparisonPending}
													onclick={() =>
														onSelectCompare(selectedFromRev, isTo ? null : record.eventHeight)}
													aria-label={`기록 #${record.eventHeight} ${isTo ? '대상 선택됨' : '비교 대상으로 선택'}`}
													data-testid={`revision-target-${record.eventHeight}`}
													>{isTo ? '대상 선택됨' : '비교 대상으로 선택'}</button
												>
											{/if}
										{/if}
									</div>
									<details data-testid={`revision-metadata-${record.eventHeight}`}>
										<summary class="lc-text-muted cursor-pointer text-xs">수집·검증 정보</summary>
										<dl class="lc-text-muted mt-2 space-y-1 text-xs wrap-anywhere">
											<div>
												<dt class="inline font-semibold">수집 출처:</dt>
												<dd class="inline">{toReadableSourceLabel(record.source)}</dd>
											</div>
											<div>
												<dt class="inline font-semibold">검증 해시:</dt>
												<dd class="inline font-mono">{record.eventHash}</dd>
											</div>
										</dl>
									</details>
									{#if isCompareMode && (isFrom || isTo)}<a
											href="#revision-comparison"
											class="lc-link inline-block py-1 text-sm"
											data-testid={`revision-result-${record.eventHeight}`}>비교 결과 보기</a
										>{/if}
								</div>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		</div>
	{/if}
</details>
