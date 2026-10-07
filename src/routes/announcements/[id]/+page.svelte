<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let pageUrl = $derived(page.url.origin + page.url.pathname);
	let description = $derived(
		data.notice.content ? data.notice.content.slice(0, 160) : data.notice.title
	);
</script>

<SeoHead title={data.notice.title} {description} url={pageUrl} keywords="공지사항, LawCast 공지" />

<div class="lc-page-shell">
	<Header />

	<main
		id="main-content"
		class="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
		aria-labelledby="admin-notice-title"
		data-testid="admin-notice-detail"
	>
		<nav class="mb-8 flex items-center space-x-3 text-sm" aria-label="이동 경로">
			<a
				href="/announcements"
				data-testid="admin-notice-back-link"
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2 transition-all duration-200"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				공지사항
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<span class="lc-text-secondary font-semibold">공지 상세</span>
		</nav>

		<article class="lc-panel-card rounded-md border p-5 sm:p-6">
			<h1
				id="admin-notice-title"
				class="lc-text-primary text-2xl leading-snug font-bold tracking-tight"
				data-testid="admin-notice-title"
			>
				{data.notice.title}
			</h1>
			{#if data.notice.status}
				<span
					class="lc-text-muted mt-3 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
					data-testid="admin-notice-status"
				>
					{data.notice.status}
				</span>
			{/if}

			{#if data.notice.content}
				<p
					class="lc-text-secondary mt-4 border-t pt-4 text-sm leading-7 whitespace-pre-line"
					data-testid="admin-notice-content"
				>
					{data.notice.content}
				</p>
			{:else}
				<p class="lc-text-muted mt-4 border-t pt-4 text-sm">등록된 본문이 없습니다.</p>
			{/if}
		</article>
	</main>
</div>
