<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import RecentNotices from '$lib/components/RecentNotices.svelte';
	import { navigating, page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faMagnifyingGlass, faSpinner } from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';

	export let data: PageData;

	$: ({ recentNotices, stats } = data);
	$: archiveTotalCount = stats?.archive?.count ?? 0;
	$: aiSummaryEnabled =
		(stats as { aiSummaryEnabled?: boolean } | undefined)?.aiSummaryEnabled !== false;
	$: pageDescription = aiSummaryEnabled
		? '국회 입법예고 변동사항을 디스코드로 빠르게 받아보세요. 최신 입법예고 목록과 AI의 요약을 한 번에 확인할 수 있습니다.'
		: '국회 입법예고 변동사항을 디스코드로 빠르게 받아보세요. 최신 입법예고 목록과 원문 정보를 한 번에 확인할 수 있습니다.';
	$: isQuickSearchLoading =
		!!$navigating?.to?.url && $navigating.to.url.pathname.replace(/\/+$/, '') === '/notices';

	function safeJsonLd(data: object): string {
		return JSON.stringify(data)
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e')
			.replace(/&/g, '\\u0026');
	}

	$: pageUrl = $page.url.origin + '/';
	$: websiteJsonLd = safeJsonLd({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'LawCast',
		url: pageUrl,
		description: '국회 입법예고 스냅샷 아카이브 서비스',
		inLanguage: 'ko',
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: `${$page.url.origin}/notices?search={search_term_string}`
			},
			'query-input': 'required name=search_term_string'
		}
	});
</script>

<svelte:head>
	<title
		>LawCast - 국회 입법예고 스냅샷 아카이브{archiveTotalCount > 0
			? ` | 전체 ${archiveTotalCount.toLocaleString('ko-KR')}건`
			: ''}</title
	>
	<link rel="canonical" href={pageUrl} />
	<meta name="description" content={pageDescription} />
	<meta
		name="keywords"
		content="LawCast, 입법예고, 국회 입법예고 알림, 국회 법률안, 법안 알림, 디스코드 웹훅, 법률안 모니터링, 입법예고 아카이브, 법안 검색"
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content={pageUrl} />
	<meta
		property="og:title"
		content={`LawCast - 국회 입법예고 스냅샷 아카이브${archiveTotalCount > 0 ? ` | 전체 ${archiveTotalCount.toLocaleString('ko-KR')}건` : ''}`}
	/>
	<meta property="og:description" content={pageDescription} />
	<meta
		name="twitter:title"
		content={`LawCast - 국회 입법예고 스냅샷 아카이브${archiveTotalCount > 0 ? ` | 전체 ${archiveTotalCount.toLocaleString('ko-KR')}건` : ''}`}
	/>
	<meta name="twitter:description" content={pageDescription} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${websiteJsonLd}<` + `/script>`}
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<div class="mt-5 flex flex-col gap-8">
			<section
				class="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm"
			>
				<h2 class="mb-3 text-base font-bold text-gray-900">법률안 빠른 검색</h2>
				<form
					method="GET"
					action="/notices"
					class="flex flex-col gap-2 sm:flex-row"
					class:pointer-events-none={isQuickSearchLoading}
					class:opacity-80={isQuickSearchLoading}
					aria-busy={isQuickSearchLoading}
				>
					<input
						type="text"
						name="search"
						placeholder="법률안명, 소관위원회, 원문 키워드 검색"
						disabled={isQuickSearchLoading}
						required
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-xs outline-hidden transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
					/>
					<button
						type="submit"
						aria-label="검색"
						title="검색"
						disabled={isQuickSearchLoading}
						class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-blue-700"
					>
						{#if isQuickSearchLoading}
							<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
						{:else}
							<FontAwesomeIcon icon={faMagnifyingGlass} class="h-4 w-4" />
						{/if}
					</button>
				</form>
				{#if isQuickSearchLoading}
					<div
						class="mt-3 h-1 w-full overflow-hidden rounded-full bg-blue-100"
						role="status"
						aria-live="polite"
					>
						<div class="loading-slide h-full w-1/3 rounded-full bg-blue-500"></div>
					</div>
				{/if}
			</section>

			<!-- Recent Notices -->
			<RecentNotices notices={recentNotices} {stats} />
		</div>
	</main>
</div>

<style>
	:global(.group:hover .transition-colors) {
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
