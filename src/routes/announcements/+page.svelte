<script lang="ts">
	import { page } from '$app/state';
	import Header from '#lib/components/Header.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { formatDateOnlyKST } from '#lib/utils/helpers.ts';
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

	<main id="main-content" class="lc-main">
		<header class="lc-page-heading space-y-2">
			<h1 class="lc-text-primary text-xl font-bold sm:text-2xl">공지사항</h1>
			<p class="lc-text-secondary text-sm leading-6">
				운영 공지와 서비스 안내를 한곳에서 모아 보여줍니다.
			</p>
		</header>

		{#if notices.length === 0}
			<div class="lc-open-empty-state" data-testid="admin-notices-empty-state">
				<p class="lc-text-primary text-base font-semibold">등록된 공지가 없습니다.</p>
				<p class="lc-text-muted mt-2 text-sm">새 공지가 올라오면 이곳에서 확인할 수 있습니다.</p>
			</div>
		{:else}
			<div class="lc-flat-list lc-announcement-list" data-testid="admin-notices-list">
				{#each notices as notice (notice.id)}
					<a
						href={`/announcements/${encodeURIComponent(notice.id)}`}
						data-testid={`admin-notices-list-link-${notice.id}`}
						class="lc-flat-list-row lc-card-list-link cursor-pointer text-inherit no-underline"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<div class="lc-text-muted mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
									{#if notice.status}
										<span class="lc-flat-status lc-text-secondary font-semibold"
											>{notice.status}</span
										>
									{/if}
									{#if notice.createdAt}
										<time
											datetime={notice.createdAt}
											data-testid={`admin-notices-list-date-${notice.id}`}
											class="tabular-nums"
										>
											{formatDateOnlyKST(notice.createdAt)}
										</time>
									{/if}
								</div>
								<h2
									class="lc-text-primary lc-list-title underline decoration-[var(--lc-border-strong)] underline-offset-4"
								>
									{notice.title}
								</h2>
								{#if notice.content}
									<p
										class="lc-text-secondary mt-2 line-clamp-2 text-sm leading-relaxed wrap-anywhere"
									>
										{notice.content}
									</p>
								{/if}
							</div>
							<FontAwesomeIcon icon={faChevronRight} class="lc-text-muted mt-1 h-4 w-4 shrink-0" />
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</main>
</div>
