<script lang="ts">
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import {
		buildInlineDiffSegments,
		formatRevisionValue,
		type RevisionDiffItem
	} from '$lib/utils/revision-comparison';

	let {
		isCompareMode,
		selectedFromRev,
		selectedToRev,
		showAllCompareFields,
		onToggleCompareShowAll,
		revisionDiffItems,
		comparisonPending,
		fromDate,
		toDate
	}: {
		isCompareMode: boolean;
		selectedFromRev: number | null;
		selectedToRev: number | null;
		showAllCompareFields: boolean;
		onToggleCompareShowAll: () => Promise<void> | void;
		revisionDiffItems: RevisionDiffItem[];
		comparisonPending: boolean;
		fromDate?: string;
		toDate?: string;
	} = $props();

	let changedItems = $derived(revisionDiffItems.filter((item) => item.changeType !== 'unchanged'));
	let visibleItems = $derived(showAllCompareFields ? revisionDiffItems : changedItems);
	let unchangedCount = $derived(revisionDiffItems.length - changedItems.length);

	function changeTypeLabel(changeType: RevisionDiffItem['changeType']): string {
		if (changeType === 'added') return '추가됨';
		if (changeType === 'removed') return '삭제됨';
		if (changeType === 'modified') return '수정됨';
		return '변경 없음';
	}
</script>

{#if isCompareMode && selectedFromRev !== null && selectedToRev !== null}
	<section
		id="revision-comparison"
		class="lc-panel-inset scroll-mt-40 space-y-4 rounded-xl border p-4"
		aria-labelledby="revision-comparison-heading"
		data-testid="revision-comparison"
	>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 id="revision-comparison-heading" class="lc-text-primary font-semibold">
					변경 내용 비교
				</h3>
				<p class="lc-text-secondary mt-1 text-sm" role="status" data-testid="revision-diff-summary">
					바뀐 항목 {changedItems.length}개 · 변경 없는 항목 {unchangedCount}개
				</p>
			</div>
			<button
				type="button"
				class="lc-button-neutral rounded-lg border px-3 py-2 text-sm"
				disabled={comparisonPending}
				aria-pressed={showAllCompareFields}
				onclick={onToggleCompareShowAll}
				data-testid="compare-show-all"
				>{showAllCompareFields ? '변경 필드만 보기' : '전체 필드 보기'}</button
			>
		</div>
		<div class="grid gap-3 sm:grid-cols-2" data-testid="comparison-direction">
			<div class="rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-primary) p-3">
				<p class="lc-text-primary text-sm font-semibold">기준 기록 #{selectedFromRev}</p>
				{#if fromDate}<p class="lc-text-muted mt-1 text-xs">{formatDateTimeKST(fromDate)}</p>{/if}
			</div>
			<div class="rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-primary) p-3">
				<p class="lc-text-primary text-sm font-semibold">대상 기록 #{selectedToRev}</p>
				{#if toDate}<p class="lc-text-muted mt-1 text-xs">{formatDateTimeKST(toDate)}</p>{/if}
			</div>
		</div>
		{#if selectedFromRev > selectedToRev}
			<p class="lc-banner-muted rounded-lg border p-3 text-sm" data-testid="comparison-reverse">
				이전 시점으로 거슬러 비교하고 있습니다. 시간순으로 보려면 ‘기준·대상 바꾸기’를 눌러주세요.
			</p>
		{/if}
		<p class="lc-text-secondary flex flex-wrap gap-3 text-xs">
			<span><span class="lc-diff-removed px-1">삭제된 내용</span>은 기준 기록에만 있습니다.</span
			><span><span class="lc-diff-added px-1">추가된 내용</span>은 대상 기록에만 있습니다.</span>
		</p>

		{#if revisionDiffItems.length === 0}
			<p
				class="lc-panel-card rounded-lg border p-4 text-sm"
				data-testid="comparison-unavailable-fields"
			>
				두 기록에서 비교할 수 있는 항목을 확인하지 못했습니다.
			</p>
		{:else if changedItems.length === 0}
			<p class="lc-panel-card rounded-lg border p-4 text-sm" data-testid="comparison-no-changes">
				두 기록에서 확인할 수 있는 항목의 내용이 같습니다.
			</p>
		{/if}
		{#if !showAllCompareFields && unchangedCount > 0}
			<p class="lc-text-muted text-xs">
				변경 없는 {unchangedCount}개 항목은 접어두었습니다. ‘전체 필드 보기’에서 확인할 수 있습니다.
			</p>
		{/if}
		<div class="space-y-3">
			{#each visibleItems as item (item.fieldPath)}
				{@const diff = buildInlineDiffSegments(
					formatRevisionValue(item.fieldPath, item.beforeValue),
					formatRevisionValue(item.fieldPath, item.afterValue)
				)}
				<details
					open={item.changeType !== 'unchanged'}
					class="lc-panel-card rounded-lg border p-3"
					data-testid={`revision-diff-${item.fieldPath}`}
				>
					<summary class="lc-text-primary cursor-pointer text-sm font-semibold">
						{item.fieldLabel}
						<span class="lc-chip-muted ml-2 rounded-full px-2 py-1 text-xs font-normal"
							>{changeTypeLabel(item.changeType)}</span
						>
					</summary>
					<div class="mt-3 grid gap-3 md:grid-cols-2">
						<div class="min-w-0">
							<p class="lc-text-secondary mb-1 text-xs font-semibold">
								기준 기록 #{selectedFromRev}
							</p>
							<div
								class="lc-text-primary rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-primary) p-3 text-sm leading-7 wrap-anywhere whitespace-pre-wrap"
								data-testid={`revision-before-${item.fieldPath}`}
							>
								{#if diff.beforeSegments.length === 0}<span class="lc-text-muted">내용 없음</span>
								{:else}{#each diff.beforeSegments as segment, index (index)}<span
											class={segment.kind === 'removed' ? 'lc-diff-removed' : ''}
											>{segment.text}</span
										>{/each}{/if}
							</div>
						</div>
						<div class="min-w-0">
							<p class="lc-text-secondary mb-1 text-xs font-semibold">대상 기록 #{selectedToRev}</p>
							<div
								class="lc-text-primary rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-primary) p-3 text-sm leading-7 wrap-anywhere whitespace-pre-wrap"
								data-testid={`revision-after-${item.fieldPath}`}
							>
								{#if diff.afterSegments.length === 0}<span class="lc-text-muted">내용 없음</span>
								{:else}{#each diff.afterSegments as segment, index (index)}<span
											class={segment.kind === 'added' ? 'lc-diff-added' : ''}>{segment.text}</span
										>{/each}{/if}
							</div>
						</div>
					</div>
				</details>
			{/each}
		</div>
	</section>
{/if}
