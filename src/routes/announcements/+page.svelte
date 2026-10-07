<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { formatDateOnlyKST } from '$lib/utils/helpers';
	import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let notices = $derived(data.notices);
	let pageUrl = $derived(page.url.origin + '/announcements');
</script>

<SeoHead
	title="공지사항"
	description="LawCast 운영 공지와 서비스 안내를 한곳에서 모아 볼 수 있습니다."
	url={pageUrl}
	keywords="공지사항, LawCast 공지, 운영 공지, 서비스 안내"
/>

<div class="lc-page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
		<header class="mb-6 space-y-2">
			<h1 class="lc-text-primary text-xl font-bold sm:text-2xl">공지사항</h1>
			<p class="lc-text-secondary text-sm leading-6">
				운영 공지와 서비스 안내를 한곳에서 모아 보여줍니다.
			</p>
		</header>

		{#if notices.length === 0}
			<div
				class="rounded-xl border border-dashed border-[var(--lc-border-soft)] p-8 text-center"
				data-testid="admin-notices-empty-state"
			>
				<p class="lc-text-primary text-sm font-semibold">등록된 공지가 없습니다.</p>
				<p class="lc-text-muted mt-1 text-xs">새 공지가 올라오면 이곳에서 확인할 수 있습니다.</p>
			</div>
		{:else}
			<div
				class="divide-y divide-[var(--lc-border-soft)] overflow-hidden rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)]"
				data-testid="admin-notices-list"
			>
				{#each notices as notice (notice.id)}
					<a
						href={`/announcements/${encodeURIComponent(notice.id)}`}
						data-testid={`admin-notices-list-link-${notice.id}`}
						class="group flex cursor-pointer flex-col gap-2 p-4 text-inherit no-underline transition-colors hover:bg-[var(--lc-surface-hover)] sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0 flex-1 space-y-1">
							<div class="flex flex-wrap items-center gap-2">
								{#if notice.status}
									<span
										class="lc-chip-muted inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
									>
										{notice.status}
									</span>
								{/if}
								<h2
									class="lc-text-primary truncate text-sm font-semibold group-hover:text-blue-600"
								>
									{notice.title}
								</h2>
							</div>
							{#if notice.content}
								<p class="lc-text-muted truncate text-xs">{notice.content}</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-3 self-start sm:self-center">
							{#if notice.createdAt}
								<time
									class="lc-text-dim text-xs tabular-nums"
									datetime={notice.createdAt}
									data-testid={`admin-notices-list-date-${notice.id}`}
								>
									{formatDateOnlyKST(notice.createdAt)}
								</time>
							{/if}
							<FontAwesomeIcon
								icon={faChevronRight}
								class="lc-text-dim hidden h-3 w-3 transition-transform group-hover:translate-x-0.5 sm:inline-block"
							/>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</main>
</div>
