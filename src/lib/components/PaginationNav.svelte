<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faAnglesLeft,
		faAnglesRight,
		faChevronLeft,
		faChevronRight,
		faSpinner
	} from '@fortawesome/free-solid-svg-icons';

	let {
		currentPage,
		totalPages,
		totalItems,
		limit,
		pendingPage = null,
		buildHref,
		onPageClick,
		ariaLabel = '페이지 내비게이션',
		testId
	}: {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		limit: number;
		pendingPage?: number | null;
		buildHref: (page: number) => string;
		onPageClick: (event: MouseEvent, targetPage: number) => void;
		ariaLabel?: string;
		testId?: string;
	} = $props();

	let paginationItems = $derived(
		(() => {
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
		})()
	);

	let paginationInfo = $derived(
		(() => {
			if (totalItems === 0) {
				return '0개';
			}

			const start = (currentPage - 1) * limit + 1;
			const end = Math.min(currentPage * limit, totalItems);
			return `${start.toLocaleString('ko-KR')}-${end.toLocaleString('ko-KR')} / ${totalItems.toLocaleString('ko-KR')}개`;
		})()
	);
</script>

{#snippet pageNumber(item: number)}
	<a
		href={buildHref(item)}
		onclick={(event) => onPageClick(event, item)}
		aria-label={`${item}페이지로 이동`}
		aria-current={currentPage === item ? 'page' : undefined}
		class={currentPage === item ? 'lc-pagination-active' : 'lc-pagination-btn'}
	>
		<span class="lc-pagination-number" class:invisible={pendingPage === item}>{item}</span>
		{#if pendingPage === item}
			<FontAwesomeIcon icon={faSpinner} class="lc-pagination-spinner h-4 w-4 animate-spin" />
		{/if}
	</a>
{/snippet}

{#if totalPages > 1 && totalItems > limit}
	<nav
		class="lc-pagination"
		aria-busy={pendingPage !== null}
		aria-label={ariaLabel}
		data-testid={testId || undefined}
	>
		{#if currentPage > 1}
			<a
				href={buildHref(1)}
				onclick={(event) => onPageClick(event, 1)}
				aria-label="첫 페이지로 이동"
				title="첫 페이지"
				class="lc-pagination-btn"
			>
				{#if pendingPage === 1}
					<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
				{:else}
					<FontAwesomeIcon icon={faAnglesLeft} class="h-4 w-4" />
				{/if}
			</a>
		{:else}
			<span aria-hidden="true" class="lc-pagination-disabled">
				<FontAwesomeIcon icon={faAnglesLeft} class="h-4 w-4" />
			</span>
		{/if}

		{#if currentPage > 1}
			<a
				href={buildHref(currentPage - 1)}
				onclick={(event) => onPageClick(event, currentPage - 1)}
				aria-label="이전 페이지로 이동"
				title="이전 페이지"
				class="lc-pagination-btn"
			>
				{#if pendingPage === currentPage - 1}
					<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
				{:else}
					<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
				{/if}
			</a>
		{:else}
			<span aria-hidden="true" class="lc-pagination-disabled">
				<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
			</span>
		{/if}

		{#each paginationItems as item, idx (`${item}-${idx}`)}
			{#if typeof item === 'number'}
				{#if typeof paginationItems[idx - 1] === 'string'}
					<span class="lc-pagination-gap-group">
						<span class="lc-pagination-ellipsis" aria-hidden="true">…</span>
						{@render pageNumber(item)}
					</span>
				{:else}
					{@render pageNumber(item)}
				{/if}
			{/if}
		{/each}

		{#if currentPage < totalPages}
			<a
				href={buildHref(currentPage + 1)}
				onclick={(event) => onPageClick(event, currentPage + 1)}
				aria-label="다음 페이지로 이동"
				title="다음 페이지"
				class="lc-pagination-btn"
			>
				{#if pendingPage === currentPage + 1}
					<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
				{:else}
					<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
				{/if}
			</a>
		{:else}
			<span aria-hidden="true" class="lc-pagination-disabled">
				<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
			</span>
		{/if}

		{#if currentPage < totalPages}
			<a
				href={buildHref(totalPages)}
				onclick={(event) => onPageClick(event, totalPages)}
				aria-label="마지막 페이지로 이동"
				title="마지막 페이지"
				class="lc-pagination-btn"
			>
				{#if pendingPage === totalPages}
					<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
				{:else}
					<FontAwesomeIcon icon={faAnglesRight} class="h-4 w-4" />
				{/if}
			</a>
		{:else}
			<span aria-hidden="true" class="lc-pagination-disabled">
				<FontAwesomeIcon icon={faAnglesRight} class="h-4 w-4" />
			</span>
		{/if}
	</nav>

	<div class="lc-pagination-summary">
		<span class="lc-page-count">
			{paginationInfo}
		</span>
	</div>
{/if}
