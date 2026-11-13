<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import DisclosureIndicator from '#lib/components/DisclosureIndicator.svelte';
	import type { SemanticSearchResultItem } from '#lib/types/api.ts';
	import { disclosureMotion } from '#lib/utils/disclosure-motion.ts';
	import { describeWeakProgress, WEAK_RESULT_PAGE_SIZE } from '#lib/utils/semantic-search.ts';

	let {
		results,
		renderResult,
		testId
	}: {
		results: SemanticSearchResultItem[];
		renderResult: Snippet<[SemanticSearchResultItem]>;
		testId: string;
	} = $props();

	let details: HTMLDetailsElement;
	let list = $state<HTMLDivElement>();
	let isOpen = $state(false);
	let visibleCount = $state(WEAK_RESULT_PAGE_SIZE);
	let visibleResults = $derived(results.slice(0, visibleCount));

	function setOpen(open: boolean) {
		isOpen = open;
		if (!open) visibleCount = WEAK_RESULT_PAGE_SIZE;
	}

	onMount(() => setOpen(details.open));

	async function showMore() {
		const firstNewIndex = visibleCount;
		visibleCount += WEAK_RESULT_PAGE_SIZE;
		await tick();
		// The button moves below the new batch (or disappears). Continue at the first new result.
		list?.children.item(firstNewIndex)?.querySelector<HTMLAnchorElement>('a')?.focus();
	}
</script>

<details
	bind:this={details}
	use:disclosureMotion={{ onOpenChange: setOpen }}
	class="group mt-6 border-t border-[var(--lc-border-soft)] pt-3"
	data-testid={testId}
>
	<summary class="lc-disclosure-trigger lc-disclosure-trigger--compact">
		<span class="lc-disclosure-label">
			관련도가 낮은 결과 ({results.length.toLocaleString('ko-KR')}건)
		</span>
		<DisclosureIndicator />
	</summary>
	{#if isOpen}
		<div class="mt-3 space-y-4">
			<p class="lc-text-secondary text-sm" role="status">
				{describeWeakProgress(visibleResults.length, results.length)}
			</p>
			<div class="lc-flat-list" bind:this={list}>
				{#each visibleResults as result (result.noticeNum)}
					{@render renderResult(result)}
				{/each}
			</div>
			{#if visibleCount < results.length}
				<div class="text-center">
					<button
						type="button"
						class="lc-button-neutral min-h-11 cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold"
						data-testid={`${testId}-more`}
						onclick={showMore}
					>
						관련도가 낮은 결과 더 보기 ({visibleResults.length}/{results.length})
					</button>
				</div>
			{/if}
		</div>
	{/if}
</details>
