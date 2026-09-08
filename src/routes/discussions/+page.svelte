<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import PaginationNav from '$lib/components/PaginationNav.svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faComments,
		faLock,
		faUser,
		faClock,
		faChevronRight,
		faCircleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import {
		DiscussionThreadStatus,
		type DiscussionThreadWithNoticeListResponse
	} from '$lib/types/api';
	import { formatDateTimeKST } from '$lib/utils/helpers';

	export let data: {
		threads: DiscussionThreadWithNoticeListResponse;
		status?: DiscussionThreadStatus;
		error?: string;
	};

	let currentUrl = page.url;
	let pendingPage: number | null = null;

	afterNavigate(() => {
		currentUrl = page.url;
		pendingPage = null;
	});

	$: threads = data.threads.items;
	$: total = data.threads.total;
	$: limit = data.threads.limit || 20;
	$: currentPage = data.threads.page || 1;
	$: totalPages = Math.max(1, Math.ceil(total / limit));
	$: activeStatus = data.status;

	const statusTabs: Array<{ label: string; value: DiscussionThreadStatus | undefined }> = [
		{ label: '전체', value: undefined },
		{ label: '진행 중', value: DiscussionThreadStatus.OPEN },
		{ label: '닫힘', value: DiscussionThreadStatus.CLOSED }
	];

	function buildLink(overrides: { page?: number; status?: DiscussionThreadStatus | undefined }) {
		const params = new SvelteURLSearchParams(currentUrl.searchParams);
		const targetPage = overrides.page ?? currentPage;
		const targetStatus = 'status' in overrides ? overrides.status : activeStatus;

		params.set('page', String(targetPage));
		if (targetStatus) {
			params.set('status', targetStatus);
		} else {
			params.delete('status');
		}
		return `/discussions?${params.toString()}`;
	}

	function handlePaginationClick(event: MouseEvent, targetPage: number) {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		event.preventDefault();
		pendingPage = targetPage;
		goto(buildLink({ page: targetPage }));
	}
</script>

<svelte:head>
	<title>토론 모아보기 | LawCast</title>
	<link rel="canonical" href={`${currentUrl.origin}/discussions`} />
	<meta
		name="description"
		content="법률안별로 흩어진 익명 토론 스레드를 한 곳에서 모아 찾아볼 수 있습니다."
	/>
</svelte:head>

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
		<header class="mb-6 space-y-2">
			<h1 class="lc-text-primary text-xl font-bold sm:text-2xl">토론 모아보기</h1>
			<p class="lc-text-secondary text-sm leading-6">
				여러 법률안에서 진행 중인 익명 토론 스레드를 한 곳에서 찾아보고 바로 참여할 수 있습니다.
			</p>
		</header>

		<div class="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="토론 상태 필터">
			{#each statusTabs as tab (tab.label)}
				<a
					href={buildLink({ page: 1, status: tab.value })}
					role="tab"
					aria-selected={activeStatus === tab.value}
					data-testid={`discussions-filter-${tab.value ?? 'all'}`}
					class={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
						activeStatus === tab.value
							? 'lc-button-primary border-transparent'
							: 'lc-button-neutral border-[var(--lc-border-soft)]'
					}`}
				>
					{tab.label}
				</a>
			{/each}
		</div>

		{#if data.error}
			<div
				class="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center"
				data-testid="discussions-error"
			>
				<FontAwesomeIcon icon={faCircleExclamation} class="mx-auto mb-2 h-5 w-5 text-red-500" />
				<p class="text-sm font-semibold text-red-700 dark:text-red-300">{data.error}</p>
			</div>
		{:else if threads.length === 0}
			<div
				class="rounded-xl border border-dashed border-[var(--lc-border-soft)] p-8 text-center"
				data-testid="discussions-empty-state"
			>
				<p class="lc-text-primary text-sm font-semibold">아직 조건에 맞는 토론이 없습니다.</p>
				<p class="lc-text-muted mt-1 text-xs">
					법률안 상세 페이지에서 첫 번째 토론을 시작해보세요.
				</p>
			</div>
		{:else}
			<div
				class="divide-y divide-[var(--lc-border-soft)] overflow-hidden rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)]"
				data-testid="discussions-list"
			>
				{#each threads as thread (thread.id)}
					<a
						href={`/notices/${thread.noticeNum}/discussions/${thread.id}`}
						data-testid={`discussions-list-link-${thread.id}`}
						class="group flex cursor-pointer flex-col justify-between gap-2 p-4 text-inherit no-underline transition-colors hover:bg-[var(--lc-surface-hover)] sm:flex-row sm:items-center"
					>
						<div class="min-w-0 flex-1 space-y-1">
							<div class="flex flex-wrap items-center gap-2">
								{#if thread.status === DiscussionThreadStatus.OPEN}
									<span
										class="lc-chip-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
									>
										<span class="lc-dot-success h-1.5 w-1.5 rounded-full"></span>
										진행 중
									</span>
								{:else}
									<span
										class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
									>
										<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
										닫힘
									</span>
								{/if}
								<h2
									class="lc-text-primary truncate text-sm font-semibold group-hover:text-blue-600"
								>
									{thread.title}
								</h2>
							</div>
							{#if thread.noticeSubject}
								<p class="lc-text-muted truncate text-xs">
									의안번호 {thread.noticeNum} · {thread.noticeSubject}
								</p>
							{:else}
								<p class="lc-text-muted truncate text-xs">의안번호 {thread.noticeNum}</p>
							{/if}
							<div class="lc-text-muted flex flex-wrap items-center gap-3 text-xs">
								<span class="inline-flex items-center gap-1">
									<FontAwesomeIcon icon={faUser} class="h-2.5 w-2.5" />
									{thread.authorNickname}
									<span class="font-mono text-[11px]">({thread.authorIpMasked})</span>
								</span>
								<span class="inline-flex items-center gap-1">
									<FontAwesomeIcon icon={faClock} class="h-2.5 w-2.5" />
									{formatDateTimeKST(thread.updatedAt)}
								</span>
							</div>
						</div>

						<div class="flex items-center gap-2 self-end sm:self-center">
							<span
								class="lc-chip-blue inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
								title={`의견 ${thread.commentCount.toLocaleString('ko-KR')}개`}
							>
								<FontAwesomeIcon icon={faComments} class="h-3 w-3" />
								<span>{thread.commentCount.toLocaleString('ko-KR')}</span>
							</span>
							<FontAwesomeIcon
								icon={faChevronRight}
								class="lc-text-dim hidden h-3 w-3 transition-transform group-hover:translate-x-0.5 sm:inline-block"
							/>
						</div>
					</a>
				{/each}
			</div>

			<div class="mt-4">
				<PaginationNav
					{currentPage}
					{totalPages}
					totalItems={total}
					{limit}
					{pendingPage}
					buildHref={(targetPage) => buildLink({ page: targetPage })}
					onPageClick={handlePaginationClick}
					ariaLabel="토론 목록 페이지 내비게이션"
					testId="discussions-pagination"
				/>
			</div>
		{/if}
	</main>
</div>
