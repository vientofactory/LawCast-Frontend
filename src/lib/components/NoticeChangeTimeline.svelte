<script lang="ts">
	import Alert from '#lib/components/Alert.svelte';
	import { tick } from 'svelte';
	import DisclosureIndicator from '#lib/components/DisclosureIndicator.svelte';
	import { disclosureMotion } from '#lib/utils/disclosure-motion.ts';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCodeCompare, faRightLeft } from '@fortawesome/free-solid-svg-icons';
	import NoticeRevisionCompare from '#lib/components/NoticeRevisionCompare.svelte';
	import type { NoticeChangeTimelineResponse } from '#lib/types/api.ts';
	import { NoticeChangeSource } from '#lib/types/change-source.ts';
	import { formatDateTimeKST } from '#lib/utils/helpers.ts';
	import { revisionFieldLabel, type RevisionDiffItem } from '#lib/utils/revision-comparison.ts';

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
		onRetryHistory,
		hasMore,
		loadingMore,
		loadMoreError,
		onLoadMore
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
		hasMore: boolean;
		loadingMore: boolean;
		loadMoreError: string;
		onLoadMore: () => Promise<void>;
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
	let loadMoreSentinel = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (
			!isOpen ||
			!loadMoreSentinel ||
			!hasMore ||
			loadingMore ||
			loadMoreError ||
			historyError ||
			typeof IntersectionObserver === 'undefined'
		)
			return;
		let disposed = false;
		const observer = new IntersectionObserver(
			(entries) => {
				if (!disposed && entries.some((entry) => entry.isIntersecting)) void onLoadMore();
			},
			{ rootMargin: '0px 0px 240px 0px' }
		);
		observer.observe(loadMoreSentinel);
		return () => {
			disposed = true;
			observer.disconnect();
		};
	});
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
	let workspace = $state<HTMLDetailsElement | null>(null);
	let toolbar = $state<HTMLElement | null>(null);
	let resultReader = $state<HTMLDivElement | null>(null);
	$effect(() => {
		const pair = [selectedFromRev, selectedToRev];
		if (resultReader && pair.every((revision) => revision !== null)) resultReader.scrollTop = 0;
	});
	let mobileView = $state<'records' | 'comparison'>('comparison');
	let recordScrollY: number | null = null;
	let comparisonInvoker: HTMLElement | null = null;
	$effect(() => {
		if (!workspace || !toolbar) return;
		const node = workspace;
		const header = document.querySelector<HTMLElement>('.lc-header-shell');
		const update = () => {
			const headerHeight = header?.getBoundingClientRect().height ?? 0;
			const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
			const actionsHeight =
				node.querySelector('.lc-history-actions')?.getBoundingClientRect().height ?? 0;
			const visibleHeight =
				headerHeight + toolbarHeight > window.innerHeight * 0.6 && actionsHeight > 0
					? Math.min(toolbarHeight, actionsHeight + 24)
					: toolbarHeight;
			node.style.setProperty('--lc-history-toolbar-visible', `${visibleHeight}px`);
			node.style.setProperty(
				'--lc-history-header',
				`${header?.getBoundingClientRect().height ?? 0}px`
			);
			node.style.setProperty(
				'--lc-history-toolbar',
				`${toolbar?.getBoundingClientRect().height ?? 0}px`
			);
		};
		const observer = new ResizeObserver(update);
		if (header) observer.observe(header);
		observer.observe(toolbar);
		update();
		window.addEventListener('resize', update);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', update);
		};
	});

	function revealSettings(event: FocusEvent) {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) return;
		requestAnimationFrame(() => {
			if (document.activeElement !== target || !toolbar) return;
			const headerBottom =
				document.querySelector('.lc-header-shell')?.getBoundingClientRect().bottom ?? 0;
			const rect = target.getBoundingClientRect();
			if (rect.top < headerBottom || rect.bottom > window.innerHeight) {
				window.scrollBy({
					top: toolbar.getBoundingClientRect().top - headerBottom,
					behavior: 'instant'
				});
			}
		});
	}

	async function switchPane(view: 'records' | 'comparison', captureRecordPosition = true) {
		if (!workspace || !window.matchMedia('(max-width: 1023px)').matches) return;
		if (view === mobileView) return;
		if (view === 'comparison' && captureRecordPosition) recordScrollY = window.scrollY;
		mobileView = view;
		await tick();
		const top =
			view === 'records'
				? (recordScrollY ??
					workspace.getBoundingClientRect().top +
						window.scrollY -
						(document.querySelector('.lc-header-shell')?.getBoundingClientRect().height ?? 0))
				: workspace.getBoundingClientRect().top +
					window.scrollY -
					(document.querySelector('.lc-header-shell')?.getBoundingClientRect().height ?? 0);
		window.scrollTo({ top, behavior: 'instant' });
	}

	async function selectComparison(from: number | null, to: number | null) {
		const wasComparing = isCompareMode;
		if (!wasComparing) {
			recordScrollY = window.scrollY;
			comparisonInvoker =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
		}
		await onSelectCompare(from, to);
		if (!workspace) return;
		const isMobile = window.matchMedia('(max-width: 1023px)').matches;
		if (!isMobile) {
			if (from === null && to === null)
				(comparisonInvoker?.isConnected
					? comparisonInvoker
					: workspace.querySelector<HTMLElement>('[data-testid="compare-latest"]')
				)?.focus({ preventScroll: true });
			return;
		}
		if (from === null && to === null) {
			mobileView = 'records';
			await tick();
			window.scrollTo({
				top:
					recordScrollY ??
					workspace.getBoundingClientRect().top +
						window.scrollY -
						(document.querySelector('.lc-header-shell')?.getBoundingClientRect().height ?? 0),
				behavior: 'instant'
			});
			await tick();
			(comparisonInvoker?.isConnected
				? comparisonInvoker
				: workspace.querySelector<HTMLElement>('[data-testid="compare-latest"]')
			)?.focus({ preventScroll: true });
		} else if (isCompareMode && !wasComparing) {
			mobileView = 'records';
			await switchPane('comparison', false);
		}
	}

	async function openComparisonResult() {
		if (window.matchMedia('(max-width: 1023px)').matches) await switchPane('comparison');
		else
			workspace?.querySelector<HTMLElement>('#revision-comparison')?.focus({ preventScroll: true });
	}
</script>

<details
	use:disclosureMotion={{ onOpenChange: (open) => (isOpen = open) }}
	bind:open={isOpen}
	class="lc-history-disclosure group"
	class:lc-history-comparing={isCompareMode}
	class:lc-history-show-result={mobileView === 'comparison'}
	bind:this={workspace}
	data-testid="revision-history"
>
	<summary class="lc-disclosure-trigger" data-testid="revision-history-toggle">
		<span class="flex min-w-0 items-center gap-2">
			<FontAwesomeIcon icon={faCodeCompare} class="lc-text-accent h-5 w-5 shrink-0" />
			<h2 class="lc-text-primary text-lg font-bold">변경 기록</h2>
			<span class="lc-text-muted text-sm"
				>{historyError ? '불러오기 실패' : `${records.length}개`}</span
			>
		</span>
		<DisclosureIndicator />
	</summary>

	{#if isOpen}
		<div>
			<div class="mt-4 space-y-5">
				<p class="lc-text-secondary text-sm leading-relaxed">
					LawCast가 보존한 기록을 최신순으로 보여드립니다. 기록을 열어 당시 내용을 보거나, 두 기록
					사이에 바뀐 내용을 비교할 수 있습니다.
					<span class="lc-text-muted mt-1 block"
						>국회 정보의 수집·보완도 기록에 포함되며, 법률안 자체가 수정되었다는 의미는 아닙니다.</span
					>
				</p>

				{#if hasMore}
					<p
						class="lc-banner-muted rounded-lg border p-3 text-sm"
						data-testid="revision-history-window"
					>
						현재 {records.length}개 기록을 불러왔습니다. 목록 아래로 이동하면 이전 기록이
						이어집니다.
						<button
							type="button"
							class="lc-link ml-1 underline disabled:cursor-wait"
							disabled={loadingMore}
							onclick={onLoadMore}
							data-testid="revision-history-load-older-top"
							>{loadingMore ? '불러오는 중…' : '이전 기록 불러오기'}</button
						>
					</p>
				{/if}

				{#if records.length > 1}
					<section
						class="lc-history-selection space-y-3"
						bind:this={toolbar}
						onfocusin={revealSettings}
						aria-labelledby="revision-selection-heading"
						aria-busy={comparisonPending}
						data-testid="revision-selection"
					>
						<div
							class="lc-history-selection-heading flex flex-wrap items-center justify-between gap-2"
						>
							<h3 id="revision-selection-heading" class="lc-text-primary font-semibold">
								두 기록 비교하기
							</h3>
							{#if !hasSelection}
								<button
									type="button"
									class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
									disabled={comparisonPending}
									onclick={() => selectComparison(records[1].eventHeight, records[0].eventHeight)}
									data-testid="compare-latest">최근 변경 비교</button
								>
							{/if}
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="lc-text-secondary min-w-0 text-sm font-semibold">
								기준 기록
								<select
									class="lc-text-primary mt-1 w-full min-w-0 rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-primary) p-2.5"
									value={selectedFromRev ?? ''}
									disabled={comparisonPending}
									onchange={(event) =>
										selectComparison(
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
										selectComparison(
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
						<p
							class="lc-history-selection-status lc-text-secondary text-sm"
							role="status"
							data-testid="comparison-status"
						>
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
							<div class="lc-history-actions flex flex-wrap gap-2">
								<button
									type="button"
									class="lc-history-recent lc-button-neutral rounded-lg border px-3 py-2 text-sm"
									disabled={comparisonPending}
									onclick={() => selectComparison(records[1].eventHeight, records[0].eventHeight)}
									data-testid="compare-latest">최근 비교</button
								>

								{#if isCompareMode}
									<div
										class="lc-history-pane-switch flex gap-1"
										role="group"
										aria-label="변경 기록 보기 방식"
									>
										<button
											type="button"
											class="lc-button-neutral rounded-lg px-3 py-2 text-sm"
											aria-pressed={mobileView === 'records'}
											onclick={() => switchPane('records')}
											data-testid="history-show-records">목록</button
										>
										<button
											type="button"
											class="lc-button-neutral rounded-lg px-3 py-2 text-sm"
											aria-pressed={mobileView === 'comparison'}
											onclick={() => switchPane('comparison')}
											data-testid="history-show-comparison">비교</button
										>
									</div>
								{/if}
								<button
									type="button"
									class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
									disabled={comparisonPending || !isCompareMode}
									onclick={() => selectComparison(selectedToRev, selectedFromRev)}
									aria-label="기준·대상 바꾸기"
									title="기준·대상 바꾸기"
									data-testid="compare-swap"
									><FontAwesomeIcon icon={faRightLeft} class="h-4 w-4" /><span
										class="lc-history-swap-label">기준·대상 바꾸기</span
									></button
								>
								<button
									type="button"
									class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
									disabled={comparisonPending}
									onclick={() => selectComparison(null, null)}
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
					<Alert
						type="warning"
						message={comparisonError}
						onDismiss={() => (comparisonError = '')}
						testId="comparison-error"
					/>
				{/if}

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
					<div class="lc-history-panes">
						<div class="lc-history-records-pane" id="revision-records-pane">
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
										<div class="lc-history-record space-y-3">
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
												<time datetime={record.detectedAt}
													>{formatDateTimeKST(record.detectedAt)}</time
												>
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
												{#if isViewed}
													<button
														type="button"
														disabled
														aria-current="page"
														class="lc-text-muted cursor-not-allowed rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-muted) px-3 py-2 text-sm"
														aria-label={`현재 열람 중: 기록 #${record.eventHeight}`}
														data-testid={`revision-view-${record.eventHeight}`}>열람 중</button
													>
												{:else}
													<a
														href={buildRevisionLink(record.eventHeight)}
														class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
														aria-label={`이 기록 열람: 기록 #${record.eventHeight}`}
														data-testid={`revision-view-${record.eventHeight}`}>이 기록 열람</a
													>
												{/if}
												{#if records[index + 1]}
													<button
														type="button"
														class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
														disabled={comparisonPending}
														onclick={() =>
															selectComparison(records[index + 1].eventHeight, record.eventHeight)}
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
															selectComparison(isFrom ? null : record.eventHeight, selectedToRev)}
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
																selectComparison(selectedFromRev, isTo ? null : record.eventHeight)}
															aria-label={`기록 #${record.eventHeight} ${isTo ? '대상 선택됨' : '비교 대상으로 선택'}`}
															data-testid={`revision-target-${record.eventHeight}`}
															>{isTo ? '대상 선택됨' : '비교 대상으로 선택'}</button
														>
													{/if}
												{/if}
											</div>
											<details
												use:disclosureMotion
												data-testid={`revision-metadata-${record.eventHeight}`}
											>
												<summary
													class="lc-disclosure-trigger lc-disclosure-trigger--compact text-sm"
													><span class="lc-disclosure-label">수집·검증 정보</span
													><DisclosureIndicator /></summary
												>
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
											{#if isCompareMode && (isFrom || isTo)}<button
													type="button"
													onclick={openComparisonResult}
													class="lc-link inline-flex min-h-11 items-center py-1 text-sm"
													data-testid={`revision-result-${record.eventHeight}`}
													>비교 결과 보기</button
												>{/if}
										</div>
									</li>
								{/each}
							</ol>
							<div bind:this={loadMoreSentinel} class="h-px" aria-hidden="true"></div>
							<p class="sr-only" role="status" data-testid="revision-history-loading-status">
								{loadingMore ? '이전 변경 기록을 불러오는 중입니다.' : ''}
							</p>
							<div aria-busy={loadingMore} data-testid="revision-history-loading-region">
								{#if loadingMore}
									<div
										class="lc-timeline space-y-4"
										aria-hidden="true"
										data-testid="revision-history-skeleton"
									>
										{#each [0, 1, 2] as index (index)}
											<div
												class="lc-panel-inset space-y-3 rounded-xl border p-4 motion-safe:animate-pulse"
											>
												<div class="flex gap-2">
													<div class="h-5 w-24 rounded bg-(--lc-border-soft)"></div>
													<div class="h-5 w-16 rounded bg-(--lc-border-soft)"></div>
												</div>
												<div class="h-4 w-40 rounded bg-(--lc-border-soft)"></div>
												<div class="h-4 w-3/4 rounded bg-(--lc-border-soft)"></div>
												<div class="flex gap-2">
													<div class="h-9 w-24 rounded bg-(--lc-border-soft)"></div>
													<div class="h-9 w-32 rounded bg-(--lc-border-soft)"></div>
												</div>
											</div>
										{/each}
									</div>
								{:else if loadMoreError}
									<Alert
										type="warning"
										message={loadMoreError}
										onDismiss={() => (loadMoreError = '')}
										testId="revision-history-more-error"
									/>
								{/if}
								{#if hasMore}
									<button
										type="button"
										class="lc-button-neutral mt-4 w-full rounded-lg border px-4 py-3 text-sm disabled:cursor-wait"
										disabled={loadingMore}
										onclick={onLoadMore}
										data-testid="revision-history-load-older"
										>{loadingMore
											? '이전 기록 불러오는 중…'
											: loadMoreError
												? '이전 기록 다시 불러오기'
												: '이전 기록 더 보기'}</button
									>
								{:else}
									<p
										role="status"
										class="lc-text-muted py-4 text-center text-sm"
										tabindex="-1"
										data-testid="revision-history-complete"
									>
										보존된 변경 기록 {records.length}개를 모두 불러왔습니다.
									</p>
								{/if}
							</div>
						</div>
						{#if isCompareMode}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex (The bounded desktop reading pane must support keyboard scrolling.) -->
							<div
								class="lc-history-result-pane"
								bind:this={resultReader}
								role="region"
								aria-label="비교 결과 읽기"
								tabindex="0"
							>
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
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</details>

<style>
	/* Pane switches restore scroll explicitly; native anchoring must not offset it again. */
	.lc-history-disclosure {
		overflow-anchor: none;
	}

	.lc-history-disclosure {
		--lc-history-header: 7rem;
		--lc-history-toolbar: 12rem;
		--lc-history-toolbar-visible: 12rem;
	}
	.lc-history-comparing .lc-history-selection {
		position: sticky;
		top: calc(
			var(--lc-history-header) + var(--lc-history-toolbar-visible) - var(--lc-history-toolbar)
		);
		z-index: 30;
		background: var(--lc-surface-primary);
		padding: 0.75rem;
		border: 1px solid var(--lc-border-soft);
	}
	.lc-history-comparing .lc-history-selection:has(select:focus) {
		top: var(--lc-history-header);
	}
	.lc-history-comparing .lc-history-selection-heading {
		display: none;
	}
	.lc-history-comparing .lc-history-selection-status {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.lc-history-actions {
		align-items: center;
	}
	.lc-history-pane-switch {
		margin-right: auto;
	}
	.lc-history-pane-switch [aria-pressed='true'] {
		background: var(--lc-surface-muted);
		color: var(--lc-text-primary);
		box-shadow: inset 0 -2px var(--lc-text-accent);
	}
	.lc-history-panes,
	.lc-history-records-pane,
	.lc-history-result-pane {
		min-width: 0;
	}
	.lc-history-result-pane :global(#revision-comparison) {
		scroll-margin-top: calc(var(--lc-history-header) + var(--lc-history-toolbar-visible) + 1rem);
	}
	.lc-history-result-pane {
		scrollbar-gutter: stable;
	}
	@media (max-width: 1023px) {
		.lc-history-recent,
		.lc-history-swap-label {
			display: none;
		}
		.lc-history-pane-switch {
			flex: 1 1 8rem;
			min-width: 0;
		}
		.lc-history-pane-switch button {
			flex: 1;
			min-width: 0;
			overflow-wrap: anywhere;
		}

		.lc-history-comparing.lc-history-show-result .lc-history-records-pane,
		.lc-history-comparing:not(.lc-history-show-result) .lc-history-result-pane {
			display: none;
		}
		.lc-history-comparing .lc-history-selection :global(select) {
			font-size: 0.875rem;
			padding: 0.5rem;
			min-height: 2.75rem;
		}
		.lc-history-comparing .lc-history-selection > :global(.grid) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.lc-history-comparing .lc-history-actions {
			gap: 0.25rem;
		}
		.lc-history-comparing .lc-history-actions :global(button) {
			padding-inline: 0.25rem;
		}
	}
	@media (min-width: 1024px) {
		.lc-history-pane-switch {
			display: none;
		}
		.lc-history-comparing .lc-history-panes {
			display: grid;
			grid-template-columns: minmax(17rem, 0.7fr) minmax(0, 1.3fr);
			align-items: start;
			gap: 1.75rem;
		}
		.lc-history-comparing .lc-history-result-pane {
			position: sticky;
			top: calc(var(--lc-history-header) + var(--lc-history-toolbar-visible) + 1rem);
			max-height: max(
				8rem,
				calc(100dvh - var(--lc-history-header) - var(--lc-history-toolbar-visible) - 2rem)
			);
			overflow: auto;
			overscroll-behavior: contain;
			padding-inline: 0.25rem 0.75rem;
		}
	}
	@media (min-width: 1024px) and (max-height: 650px) {
		.lc-history-comparing .lc-history-result-pane {
			position: static;
			max-height: none;
			overflow: visible;
		}
	}
</style>
