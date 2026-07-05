<script lang="ts">
	type RevisionDiffItem = {
		fieldPath: string;
		fieldLabel: string;
		changeType: 'added' | 'removed' | 'modified' | 'unchanged';
		beforeValue: string | null;
		afterValue: string | null;
	};

	export let isCompareMode: boolean;
	export let selectedFromRev: number | null;
	export let selectedToRev: number | null;
	export let showAllCompareFields: boolean;
	export let clearCompareHref: string;
	export let onToggleCompareShowAll: () => Promise<void> | void;
	export let revisionDiffItems: RevisionDiffItem[];

	function changeTypeLabel(changeType: RevisionDiffItem['changeType']): string {
		switch (changeType) {
			case 'added':
				return '추가됨';
			case 'removed':
				return '삭제됨';
			case 'modified':
				return '수정됨';
			default:
				return '변경 없음';
		}
	}

	function buildInlineDiffSegments(
		beforeValue: string | null,
		afterValue: string | null
	): {
		beforeSegments: Array<{ text: string; kind: 'context' | 'removed' | 'added' }>;
		afterSegments: Array<{ text: string; kind: 'context' | 'removed' | 'added' }>;
	} {
		const before = beforeValue ?? '';
		const after = afterValue ?? '';

		if (before === after) {
			return {
				beforeSegments: before ? [{ text: before, kind: 'context' }] : [],
				afterSegments: after ? [{ text: after, kind: 'context' }] : []
			};
		}

		let prefixLength = 0;
		const maxPrefixLength = Math.min(before.length, after.length);
		while (prefixLength < maxPrefixLength && before[prefixLength] === after[prefixLength]) {
			prefixLength += 1;
		}

		let suffixLength = 0;
		const maxSuffixLength = Math.min(before.length - prefixLength, after.length - prefixLength);
		while (
			suffixLength < maxSuffixLength &&
			before[before.length - 1 - suffixLength] === after[after.length - 1 - suffixLength]
		) {
			suffixLength += 1;
		}

		const beforePrefix = before.slice(0, prefixLength);
		const beforeChanged = before.slice(prefixLength, before.length - suffixLength);
		const beforeSuffix = before.slice(before.length - suffixLength);

		const afterPrefix = after.slice(0, prefixLength);
		const afterChanged = after.slice(prefixLength, after.length - suffixLength);
		const afterSuffix = after.slice(after.length - suffixLength);

		return {
			beforeSegments: [
				...(beforePrefix ? [{ text: beforePrefix, kind: 'context' as const }] : []),
				...(beforeChanged ? [{ text: beforeChanged, kind: 'removed' as const }] : []),
				...(beforeSuffix ? [{ text: beforeSuffix, kind: 'context' as const }] : [])
			],
			afterSegments: [
				...(afterPrefix ? [{ text: afterPrefix, kind: 'context' as const }] : []),
				...(afterChanged ? [{ text: afterChanged, kind: 'added' as const }] : []),
				...(afterSuffix ? [{ text: afterSuffix, kind: 'context' as const }] : [])
			]
		};
	}
</script>

{#if isCompareMode && selectedFromRev !== null && selectedToRev !== null}
	<div class="lc-panel-inset mb-4 rounded-xl border p-3">
		<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
			<p class="lc-text-secondary text-xs font-semibold">
				리비전 비교 열람 중: Rev #{selectedFromRev} -> Rev #{selectedToRev}
				{#if showAllCompareFields}
					<span
						class="ml-2 rounded-full border border-(--lc-border-soft) px-2 py-0.5 text-[11px] font-bold"
					>
						전체 필드
					</span>
				{/if}
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					on:click={onToggleCompareShowAll}
					class="lc-button-neutral cursor-pointer rounded-md border px-2 py-1.5 text-xs font-semibold"
				>
					{showAllCompareFields ? '변경 필드만 보기' : '전체 필드 보기'}
				</button>
				<a
					href={clearCompareHref}
					class="lc-button-neutral cursor-pointer rounded-md border px-2 py-1.5 text-xs font-semibold"
				>
					비교 종료
				</a>
			</div>
		</div>

		{#if revisionDiffItems.length === 0}
			<p class="lc-text-muted text-xs">표시할 비교 항목이 없습니다.</p>
		{:else}
			<div class="space-y-2">
				{#each revisionDiffItems as item (`main-revision-diff-${item.fieldPath}`)}
					{@const diffSegments = buildInlineDiffSegments(item.beforeValue, item.afterValue)}
					<div class="lc-code-block rounded-md border px-3 py-2 text-xs">
						<div class="mb-1 flex items-center gap-2">
							<p class="lc-text-primary font-semibold">{item.fieldLabel}</p>
							<span class="lc-chip-muted rounded-full px-2 py-0.5 text-[11px] font-semibold">
								{changeTypeLabel(item.changeType)}
							</span>
						</div>
						<div class="grid gap-2 md:grid-cols-2">
							<div>
								<p class="lc-text-muted mb-1">Rev #{selectedFromRev}</p>
								<div
									class="rounded border border-(--lc-border-soft) bg-(--lc-surface-primary) px-2 py-1 font-mono leading-6 wrap-break-word whitespace-pre-wrap"
								>
									{#if diffSegments.beforeSegments.length === 0}
										<span class="lc-text-dim">(비어 있음)</span>
									{:else}
										{#each diffSegments.beforeSegments as segment, segmentIndex (`main-before-${item.fieldPath}-${segmentIndex}`)}
											<span
												class={segment.kind === 'removed'
													? 'lc-diff-removed'
													: 'text-(--lc-text-primary)'}>{segment.text}</span
											>
										{/each}
									{/if}
								</div>
							</div>
							<div>
								<p class="lc-text-muted mb-1">Rev #{selectedToRev}</p>
								<div
									class="rounded border border-(--lc-border-soft) bg-(--lc-surface-muted) px-2 py-1 font-mono leading-6 wrap-break-word whitespace-pre-wrap"
								>
									{#if diffSegments.afterSegments.length === 0}
										<span class="lc-text-dim">(비어 있음)</span>
									{:else}
										{#each diffSegments.afterSegments as segment, segmentIndex (`main-after-${item.fieldPath}-${segmentIndex}`)}
											<span
												class={segment.kind === 'added'
													? 'lc-diff-added'
													: 'text-(--lc-text-primary)'}>{segment.text}</span
											>
										{/each}
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
