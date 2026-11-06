<script lang="ts">
	import DisclosureIndicator from '#lib/components/DisclosureIndicator.svelte';
	import { disclosureMotion } from '#lib/utils/disclosure-motion.ts';
	import { tick } from 'svelte';
	import { buildRevisionTextDiff, splitRevisionContext } from '#lib/utils/revision-text-diff.ts';

	let {
		before,
		after,
		fieldPath,
		fieldLabel = fieldPath,
		showContext = false
	}: {
		before: string;
		after: string;
		fieldPath: string;
		fieldLabel?: string;
		showContext?: boolean;
	} = $props();
	let diff = $derived(buildRevisionTextDiff(before, after));
	let selectedChange = $derived(diff.changeCount ? 0 : -1);
	let root: HTMLDivElement;
	let numberedBlocks = $derived.by(() => {
		let changeNumber = 0;
		return diff.blocks.map((block) => ({
			block,
			changeNumber: block.kind === 'change' ? ++changeNumber : 0
		}));
	});

	async function moveChange(direction: number) {
		selectedChange = Math.max(0, Math.min(diff.changeCount - 1, selectedChange + direction));
		await tick();
		const target = root.querySelectorAll<HTMLElement>('[data-diff-hunk]')[selectedChange];
		target?.focus({ preventScroll: true });
		target?.scrollIntoView({ block: 'start', behavior: 'instant' });
	}
</script>

<div bind:this={root} class="mt-3 min-w-0 space-y-3" data-testid={`text-diff-${fieldPath}`}>
	{#if diff.changeCount > 1}
		<nav
			class="lc-panel-card sticky top-24 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
			aria-label="변경 위치 이동"
			data-testid="diff-navigation"
		>
			<button
				type="button"
				class="lc-button-neutral min-h-11 rounded-lg border px-3 py-2 text-sm"
				disabled={selectedChange === 0}
				aria-label="이전 변경"
				onclick={() => moveChange(-1)}>이전</button
			>
			<span class="lc-text-secondary text-sm" role="status"
				>변경 {selectedChange + 1} / {diff.changeCount}</span
			>
			<button
				type="button"
				class="lc-button-neutral min-h-11 rounded-lg border px-3 py-2 text-sm"
				disabled={selectedChange === diff.changeCount - 1}
				aria-label="다음 변경"
				onclick={() => moveChange(1)}>다음</button
			>
		</nav>
	{/if}
	{#if diff.coarse}
		<p class="lc-text-secondary text-sm" data-testid="diff-coarse-notice">
			변경량이 커서 일부 구간은 넓은 범위로 강조했습니다. 이전·이후 원문을 함께 확인해주세요.
		</p>
	{/if}
	{#each numberedBlocks as { block, changeNumber }, index (index)}
		{#if block.kind === 'context'}
			{@const context = splitRevisionContext(
				block.text,
				showContext && index > 0,
				showContext && index < diff.blocks.length - 1
			)}
			<div
				class="lc-text-secondary text-sm leading-7 wrap-anywhere whitespace-pre-wrap"
				data-testid="diff-context"
			>
				{context.start}{#if context.hidden}<details
						use:disclosureMotion
						class="my-2 rounded-lg border border-(--lc-border-soft) p-2"
						data-testid="diff-fold"
					>
						<summary class="lc-disclosure-trigger lc-disclosure-trigger--compact text-sm"
							><span class="lc-disclosure-label"
								>변경 없는 구간 펼치기 · {Array.from(context.hidden).length.toLocaleString(
									'ko-KR'
								)}자</span
							><DisclosureIndicator /></summary
						>
						<div class="mt-2" data-testid="diff-hidden-context">{context.hidden}</div>
					</details>{/if}{context.end}
			</div>
		{:else}
			<section
				class="lc-diff-hunk focus-visible:outline-2 focus-visible:outline-(--lc-text-accent)"
				aria-label={`${fieldLabel} 변경 ${changeNumber}`}
				tabindex="-1"
				data-diff-hunk
				data-testid="diff-hunk"
			>
				<div class="lc-diff-hunk-heading">
					변경 {changeNumber}
				</div>
				<div class="lc-diff-pair" data-testid="diff-pair">
					{#if block.beforeText}
						<div class="lc-diff-value lc-text-primary">
							<p class="lc-text-secondary mb-1 text-xs font-semibold">− 이전 내용</p>
							<div
								class="text-sm leading-7 wrap-anywhere whitespace-pre-wrap"
								data-testid={`revision-before-${fieldPath}`}
							>
								{#each block.diff.beforeSegments as segment, segmentIndex (segmentIndex)}{#if segment.kind === 'removed'}<del
											class="lc-diff-removed">{segment.text}</del
										>{:else}{segment.text}{/if}{/each}
							</div>
						</div>
					{/if}
					{#if block.afterText}
						<div class="lc-diff-value lc-text-primary">
							<p class="lc-text-secondary mb-1 text-xs font-semibold">+ 이후 내용</p>
							<div
								class="text-sm leading-7 wrap-anywhere whitespace-pre-wrap"
								data-testid={`revision-after-${fieldPath}`}
							>
								{#each block.diff.afterSegments as segment, segmentIndex (segmentIndex)}{#if segment.kind === 'added'}<ins
											class="lc-diff-added">{segment.text}</ins
										>{:else}{segment.text}{/if}{/each}
							</div>
						</div>
					{/if}
				</div>
			</section>
		{/if}
	{/each}
	{#if !before && !after}<p class="lc-text-muted text-sm">내용 없음</p>{/if}
</div>

<style>
	.lc-diff-pair {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.lc-diff-pair > div + div {
		border-top: 1px solid var(--lc-border-soft);
	}
	@media (min-width: 1024px) {
		.lc-diff-pair {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.lc-diff-pair > div + div {
			border-top: 0;
			border-left: 1px solid var(--lc-border-soft);
		}
	}
</style>
