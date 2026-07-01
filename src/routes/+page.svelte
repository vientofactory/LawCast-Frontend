<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import RecentNotices from '$lib/components/RecentNotices.svelte';
	import { formatDate } from '$lib/utils/helpers';
	import { navigating, page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faClock,
		faDatabase,
		faMagnifyingGlass,
		faRobot,
		faShieldHalved,
		faSpinner
	} from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';

	export let data: PageData;

	$: ({ recentNotices, stats } = data);
	$: archiveTotalCount = stats?.archive?.count ?? 0;
	$: aiSummaryEnabled =
		(stats as { aiSummaryEnabled?: boolean } | undefined)?.aiSummaryEnabled !== false;
	$: pageDescription = aiSummaryEnabled
		? '국회 입법예고의 최초 공개 상태를 스냅샷과 무결성 검증 기록으로 보존하고, AI 요약과 함께 빠르게 확인할 수 있습니다.'
		: '국회 입법예고의 최초 공개 상태를 스냅샷과 무결성 검증 기록으로 보존하고, 원문 정보와 함께 빠르게 확인할 수 있습니다.';
	$: isQuickSearchLoading =
		!!$navigating?.to?.url && $navigating.to.url.pathname.replace(/\/+$/, '') === '/notices';
	$: lastUpdatedLabel = stats?.cache?.lastUpdated
		? formatDate(stats.cache.lastUpdated)
		: '업데이트 대기 중';
	const heroSearchSuggestions = ['중대재해', '개인정보', 'AI', '플랫폼', '근로기준'];

	function buildQuickSearchHref(keyword: string): string {
		return `/notices?search=${encodeURIComponent(keyword)}&fullText=true`;
	}

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
		description: '국회 입법예고 스냅샷 무결성 검증 아카이브 서비스',
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
		content="LawCast, 입법예고, 국회 입법예고 알림, 국회 법률안, 법안 알림, 스냅샷 무결성 검증, 최초 상태 보존, 입법예고 아카이브, 법안 검색"
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

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-7xl px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10">
		<div class="flex flex-col gap-8">
			<section
				class="lc-home-hero -mx-4 px-4 py-6 sm:-mx-6 sm:px-6 sm:py-8 lg:-mx-8 lg:px-8 lg:py-10"
			>
				<div class="mx-auto flex max-w-4xl flex-col justify-center gap-8">
					<div class="space-y-4 text-center lg:text-left">
						<span class="lc-home-kicker inline-flex rounded-full px-3 py-1 text-xs font-semibold">
							스냅샷 무결성 검증 아카이브
						</span>
						<div class="space-y-3">
							<h1
								class="lc-text-primary text-3xl leading-tight font-black tracking-tight sm:text-4xl lg:text-5xl"
							>
								국회 입법예고
								<span class="lc-home-heading-accent block">증거 보존 플랫폼</span>
							</h1>
							<p class="lc-text-secondary mx-auto max-w-2xl text-sm leading-7 sm:text-base lg:mx-0">
								LawCast는 입법예고 원문을 최초 수집 시점 그대로 스냅샷으로 보존하고, 해시 기반
								무결성 검증 메타데이터를 함께 남겨 이후 변경이나 삭제 이후에도 검증 가능한 기록으로
								남깁니다.
							</p>
						</div>

						<div
							class="lc-home-meta flex flex-wrap items-center justify-center gap-3 lg:justify-start"
						>
							<span
								class="lc-home-meta-item inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm"
							>
								<FontAwesomeIcon icon={faDatabase} class="h-3.5 w-3.5" />
								{archiveTotalCount > 0
									? `${archiveTotalCount.toLocaleString('ko-KR')}건 아카이브`
									: '기록 수집 중'}
							</span>
							<span
								class="lc-home-meta-item inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm"
							>
								<FontAwesomeIcon icon={faShieldHalved} class="h-3.5 w-3.5" />
								무결성 검증 기반 부인방지
							</span>
							<span
								class="lc-home-meta-item inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm"
							>
								<FontAwesomeIcon icon={faClock} class="h-3.5 w-3.5" />
								마지막 업데이트 · {lastUpdatedLabel}
							</span>
							<span
								class="lc-home-meta-item inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm"
							>
								<FontAwesomeIcon icon={faRobot} class="h-3.5 w-3.5" />
								{aiSummaryEnabled ? 'AI 요약으로 빠른 검토' : '원문 중심 검토'}
							</span>
						</div>
					</div>

					<div class="lc-home-search-card rounded-[1.75rem] border p-5 sm:p-6">
						<div class="flex flex-col gap-4">
							<div class="space-y-2">
								<h2 class="lc-text-primary text-xl font-bold tracking-tight sm:text-2xl">
									법률안 빠른 검색
								</h2>
								<p class="lc-text-secondary text-sm leading-6">
									법률안명, 소관위원회, 본문 키워드를 함께 검색하고 결과 페이지에서 원문, 스냅샷,
									무결성 검증 메타데이터{aiSummaryEnabled ? ', AI 요약' : ''}까지 이어서 확인합니다.
								</p>
							</div>

							<form
								method="GET"
								action="/notices"
								class="flex flex-col gap-3"
								class:pointer-events-none={isQuickSearchLoading}
								class:opacity-80={isQuickSearchLoading}
								aria-busy={isQuickSearchLoading}
							>
								<input type="hidden" name="fullText" value="true" />
								<label for="quick-search" class="sr-only">법률안 검색</label>
								<div class="flex flex-col gap-3 sm:flex-row">
									<input
										id="quick-search"
										type="text"
										name="search"
										placeholder="예: 중대재해, 개인정보, 플랫폼, 조세특례"
										disabled={isQuickSearchLoading}
										required
										class="lc-home-search-input lc-input lc-input-focus w-full rounded-2xl border px-4 py-4 text-sm outline-hidden transition-colors"
									/>
									<button
										type="submit"
										aria-label="검색"
										title="검색"
										disabled={isQuickSearchLoading}
										class="lc-button-primary inline-flex shrink-0 cursor-pointer items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold whitespace-nowrap"
									>
										{#if isQuickSearchLoading}
											<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
										{:else}
											<FontAwesomeIcon icon={faMagnifyingGlass} class="mr-2 h-4 w-4" />
											통합 검색
										{/if}
									</button>
								</div>
							</form>

							<div class="space-y-2">
								<p class="lc-text-muted text-xs font-medium">빠른 키워드</p>
								<div class="flex flex-wrap gap-2">
									{#each heroSearchSuggestions as suggestion (suggestion)}
										<a
											href={buildQuickSearchHref(suggestion)}
											class="lc-home-search-chip rounded-full px-3 py-2 text-sm font-medium"
										>
											{suggestion}
										</a>
									{/each}
								</div>
							</div>

							{#if isQuickSearchLoading}
								<div
									class="lc-loading-track h-1.5 w-full overflow-hidden rounded-full"
									role="status"
									aria-live="polite"
								>
									<span class="sr-only">불러오는 중...</span>
									<div class="lc-loading-fill loading-slide h-full w-1/3 rounded-full"></div>
								</div>
							{/if}
						</div>
					</div>

					<a
						href="#recent-notices"
						class="lc-home-scroll-cue mx-auto inline-flex flex-col items-center gap-2 pt-2 text-sm"
						aria-label="최근 입법예고 섹션으로 이동"
					>
						<span class="lc-text-muted text-xs font-medium tracking-[0.14em]"
							>아래로 스크롤하세요!</span
						>
						<span
							class="lc-home-scroll-icon flex h-10 w-10 items-center justify-center rounded-full"
						>
							<FontAwesomeIcon icon={faChevronDown} class="h-4 w-4" />
						</span>
					</a>
				</div>
			</section>

			<!-- Recent Notices -->
			<div id="recent-notices">
				<RecentNotices notices={recentNotices} {stats} />
			</div>
		</div>
	</main>
</div>

<style>
	:global(.group:hover .transition-colors) {
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
