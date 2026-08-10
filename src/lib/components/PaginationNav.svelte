<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faAnglesLeft,
		faAnglesRight,
		faChevronLeft,
		faChevronRight,
		faSpinner
	} from '@fortawesome/free-solid-svg-icons';

	export let currentPage: number;
	export let totalPages: number;
	export let totalItems: number;
	export let limit: number;
	export let pendingPage: number | null = null;
	export let buildHref: (page: number) => string;
	export let onPageClick: (event: MouseEvent, targetPage: number) => void;
	export let ariaLabel = '페이지 내비게이션';
	export let testId: string | undefined = undefined;

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

	$: paginationInfo = (() => {
		if (totalItems === 0) {
			return '0개';
		}

		const start = (currentPage - 1) * limit + 1;
		const end = Math.min(currentPage * limit, totalItems);
		return `${start.toLocaleString('ko-KR')}-${end.toLocaleString('ko-KR')} / ${totalItems.toLocaleString('ko-KR')}개`;
	})();
</script>

{#if totalPages > 1 && totalItems > limit}
	<nav
		class="mt-12 flex flex-wrap items-center justify-center gap-2 px-2"
		aria-label={ariaLabel}
		data-testid={testId || undefined}
	>
		{#if currentPage > 1}
			<a
				href={buildHref(1)}
				on:click={(event) => onPageClick(event, 1)}
				aria-label="첫 페이지로 이동"
				title="첫 페이지"
				class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
			>
				{#if pendingPage === 1}
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
				href={buildHref(currentPage - 1)}
				on:click={(event) => onPageClick(event, currentPage - 1)}
				aria-label="이전 페이지로 이동"
				title="이전 페이지"
				class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
			>
				{#if pendingPage === currentPage - 1}
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
					href={buildHref(item)}
					on:click={(event) => onPageClick(event, item)}
					class={`rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-all duration-200 hover:shadow-md sm:px-4 sm:py-3 sm:text-sm ${
						currentPage === item
							? 'lc-pagination-active scale-105 border'
							: 'lc-pagination-btn border-2'
					}`}
				>
					{#if pendingPage === item}
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
				href={buildHref(currentPage + 1)}
				on:click={(event) => onPageClick(event, currentPage + 1)}
				aria-label="다음 페이지로 이동"
				title="다음 페이지"
				class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
			>
				{#if pendingPage === currentPage + 1}
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
				href={buildHref(totalPages)}
				on:click={(event) => onPageClick(event, totalPages)}
				aria-label="마지막 페이지로 이동"
				title="마지막 페이지"
				class="lc-pagination-btn rounded-xl border-2 px-3 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-sm"
			>
				{#if pendingPage === totalPages}
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
			{paginationInfo}
		</span>
	</div>
{/if}
