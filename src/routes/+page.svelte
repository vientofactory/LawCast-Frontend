<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import RecentNotices from '$lib/components/RecentNotices.svelte';
	import { formatDate } from '$lib/utils/helpers';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
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

	let currentUrl = page.url;
	let isQuickSearchLoading = false;

	beforeNavigate(({ to }) => {
		isQuickSearchLoading = !!to?.url && to.url.pathname.replace(/\/+$/, '') === '/notices';
	});

	afterNavigate(() => {
		currentUrl = page.url;
		isQuickSearchLoading = false;
	});

	$: ({ recentNotices, stats } = data);
	$: quickKeywords = data.quickKeywords;
	$: archiveTotalCount = stats?.archive?.count ?? 0;
	$: archiveCountLabel =
		archiveTotalCount > 0 ? `${archiveTotalCount.toLocaleString('ko-KR')}건` : '기록 수집 중';
	$: aiSummaryEnabled =
		(stats as { aiSummaryEnabled?: boolean } | undefined)?.aiSummaryEnabled !== false;
	$: comparableChangeTotal =
		(stats as { changeTracking?: { comparableEventTotal?: number } } | undefined)?.changeTracking
			?.comparableEventTotal ?? 0;
	$: comparableChangeTotalLabel = `${comparableChangeTotal.toLocaleString('ko-KR')}건`;
	$: aiReviewModeLabel = aiSummaryEnabled ? 'AI 요약 검토' : '원문 중심 검토';
	$: pageDescription = aiSummaryEnabled
		? '국회 입법예고의 최초 공개 상태를 스냅샷과 무결성 검증 기록으로 보존하고, AI 요약과 함께 빠르게 확인할 수 있습니다.'
		: '국회 입법예고의 최초 공개 상태를 스냅샷과 무결성 검증 기록으로 보존하고, 원문 정보와 함께 빠르게 확인할 수 있습니다.';
	$: lastUpdatedLabel = stats?.cache?.lastUpdated
		? formatDate(stats.cache.lastUpdated)
		: '업데이트 대기 중';
	const fallbackHeroSearchSuggestions = ['중대재해', '개인정보', 'AI', '플랫폼', '근로기준'];
	$: dynamicHeroSearchSuggestions =
		quickKeywords?.items
			?.map((item) => item.keyword)
			.filter(Boolean)
			.slice(0, 8) ?? [];
	$: heroSearchSuggestions =
		dynamicHeroSearchSuggestions.length > 0
			? dynamicHeroSearchSuggestions
			: fallbackHeroSearchSuggestions;
	$: quickKeywordUpdatedLabel = quickKeywords?.updatedAt
		? formatDate(quickKeywords.updatedAt)
		: null;

	function buildQuickSearchHref(keyword: string): string {
		return `/notices?search=${encodeURIComponent(keyword)}&fullText=true`;
	}

	function safeJsonLd(data: object): string {
		return JSON.stringify(data)
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e')
			.replace(/&/g, '\\u0026');
	}

	$: pageUrl = currentUrl.origin + '/';
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
				urlTemplate: `${currentUrl.origin}/notices?search={search_term_string}`
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

	<main
		id="main-content"
		class="mx-auto max-w-7xl px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10"
		aria-labelledby="home-page-title"
		data-testid="home-main"
	>
		<div class="flex flex-col gap-8">
			<section
				id="home-overview"
				class="lc-home-hero -mx-4 px-4 py-6 sm:-mx-6 sm:px-6 sm:py-8 lg:-mx-8 lg:px-8 lg:py-10"
				aria-labelledby="home-page-title"
				data-testid="home-hero"
			>
				<div class="lc-home-hero-content mx-auto flex max-w-4xl flex-col justify-center gap-8">
					<div class="space-y-4 text-center lg:text-left">
						<span class="lc-home-kicker inline-flex rounded-full px-3 py-1 text-xs font-semibold">
							입법예고 기록 보관소
						</span>
						<div class="space-y-3">
							<h1
								id="home-page-title"
								class="lc-text-primary text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl"
							>
								국회 입법예고
								<span class="lc-home-heading-accent block">증거 수집 플랫폼</span>
							</h1>
							<p class="lc-text-secondary mx-auto max-w-2xl text-sm leading-7 sm:text-base lg:mx-0">
								LawCast는 입법예고 원문을 처음 수집한 모습 그대로 저장하고, 나중에 내용이 바뀌거나
								사라져도 이전 기록과 비교해 확인할 수 있도록 남겨 둡니다.
							</p>
						</div>

						<section aria-labelledby="home-status-heading" data-testid="home-status-region">
							<h2 id="home-status-heading" class="sr-only">플랫폼 핵심 상태</h2>
							<div class="lc-home-signal-grid" role="list" aria-label="플랫폼 핵심 상태">
								<article
									class="lc-home-signal-card group relative overflow-hidden transition-all duration-200 focus-within:-translate-y-0.5 focus-within:shadow-lg focus-within:ring-2 focus-within:ring-sky-400/60 hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-sky-400/50"
									role="listitem"
									data-testid="home-status-card-archive"
								>
									<a
										href="/notices"
										class="block rounded-xl transition-all duration-200 focus-visible:outline-hidden"
										aria-label="전체 입법예고 조회 페이지로 이동"
										data-testid="home-status-link-archive"
									>
										<div class="lc-home-signal-head">
											<span
												class="lc-home-signal-icon transition-transform duration-200 group-focus-within:scale-110 group-focus-within:-rotate-6 group-hover:scale-110 group-hover:-rotate-6"
												aria-hidden="true"
											>
												<FontAwesomeIcon icon={faDatabase} class="h-3.5 w-3.5" />
											</span>
											<span class="lc-home-signal-tag">Archive</span>
										</div>
										<p
											class="lc-home-signal-value transition-colors duration-200 group-focus-within:text-sky-700 group-hover:text-sky-700"
										>
											{archiveCountLabel}
										</p>
										<p class="lc-home-signal-desc">처음 공개된 내용을 차곡차곡 보관</p>
										<p
											class="mt-1 text-xs font-semibold text-sky-700 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100"
										>
											클릭해서 자세히 보기
										</p>
									</a>
								</article>

								<article
									class="lc-home-signal-card group relative overflow-hidden transition-all duration-200 focus-within:-translate-y-0.5 focus-within:shadow-lg focus-within:ring-2 focus-within:ring-sky-400/60 hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-sky-400/50"
									role="listitem"
									data-testid="home-status-card-changes"
								>
									<a
										href="/notices/changes"
										class="block rounded-xl transition-all duration-200 focus-visible:outline-hidden"
										aria-label="변경 추적 페이지로 이동"
										data-testid="home-status-link-changes"
									>
										<div class="lc-home-signal-head">
											<span
												class="lc-home-signal-icon transition-transform duration-200 group-focus-within:scale-110 group-focus-within:-rotate-6 group-hover:scale-110 group-hover:-rotate-6"
												aria-hidden="true"
											>
												<FontAwesomeIcon icon={faShieldHalved} class="h-3.5 w-3.5" />
											</span>
											<span class="lc-home-signal-tag">Integrity</span>
										</div>
										<p
											class="lc-home-signal-value transition-colors duration-200 group-focus-within:text-sky-700 group-hover:text-sky-700"
										>
											{comparableChangeTotalLabel}
										</p>
										<p class="lc-home-signal-desc">비교 가능한 변경 추적 보기</p>
										<p
											class="mt-1 text-xs font-semibold text-sky-700 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100"
										>
											클릭해서 자세히 보기
										</p>
									</a>
								</article>

								<article
									class="lc-home-signal-card"
									role="listitem"
									data-testid="home-status-card-sync"
								>
									<div class="lc-home-signal-head">
										<span class="lc-home-signal-icon" aria-hidden="true">
											<FontAwesomeIcon icon={faClock} class="h-3.5 w-3.5" />
										</span>
										<span class="lc-home-signal-tag">Sync</span>
									</div>
									<p class="lc-home-signal-value">{lastUpdatedLabel}</p>
									<p class="lc-home-signal-desc">최근에 새로 가져온 시각</p>
								</article>

								<article
									class="lc-home-signal-card"
									role="listitem"
									data-testid="home-status-card-review"
								>
									<div class="lc-home-signal-head">
										<span class="lc-home-signal-icon" aria-hidden="true">
											<FontAwesomeIcon icon={faRobot} class="h-3.5 w-3.5" />
										</span>
										<span class="lc-home-signal-tag">Review</span>
									</div>
									<p class="lc-home-signal-value">{aiReviewModeLabel}</p>
									<p class="lc-home-signal-desc">검색 결과에서 원문과 요약을 함께 보기</p>
								</article>
							</div>
						</section>
					</div>

					<section
						id="home-quick-search"
						class="lc-home-search-card lc-home-search-shell rounded-[1.75rem] border p-5 sm:p-6"
						aria-labelledby="home-search-heading"
						data-testid="home-search-region"
					>
						<div class="flex flex-col gap-4">
							<div class="space-y-2">
								<h2
									id="home-search-heading"
									class="lc-text-primary text-xl font-bold tracking-tight sm:text-2xl"
								>
									법률안 빠른 검색
								</h2>
								<p id="home-search-description" class="lc-text-secondary text-sm leading-6">
									법률안 이름, 소관위원회, 본문 키워드를 한 번에 검색하고 결과 페이지에서 원문,
									저장된 기록, 변경 확인 정보{aiSummaryEnabled ? ', AI 요약' : ''}까지 이어서 볼 수
									있습니다.
								</p>
							</div>

							<form
								method="GET"
								action="/notices"
								class="lc-home-search-form flex flex-col gap-3"
								class:pointer-events-none={isQuickSearchLoading}
								class:opacity-80={isQuickSearchLoading}
								aria-busy={isQuickSearchLoading}
								aria-describedby="home-search-description"
								data-testid="home-search-form"
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
										data-testid="home-search-input"
										class="lc-home-search-input lc-input lc-input-focus w-full rounded-2xl border px-4 py-4 text-sm outline-hidden transition-colors"
									/>
									<button
										type="submit"
										aria-label="검색"
										title="검색"
										disabled={isQuickSearchLoading}
										data-testid="home-search-submit"
										class="lc-home-search-submit lc-button-primary inline-flex shrink-0 cursor-pointer items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold whitespace-nowrap"
									>
										<span class="lc-home-search-submit-inner">
											<span
												class="lc-home-search-submit-label"
												class:opacity-0={isQuickSearchLoading}
												aria-hidden={isQuickSearchLoading}
											>
												<FontAwesomeIcon icon={faMagnifyingGlass} class="mr-2 h-4 w-4" />
												통합 검색
											</span>
											<span
												class="lc-home-search-submit-spinner"
												class:opacity-0={!isQuickSearchLoading}
												aria-hidden={!isQuickSearchLoading}
											>
												<FontAwesomeIcon icon={faSpinner} class="h-4 w-4 animate-spin" />
											</span>
										</span>
									</button>
								</div>
							</form>

							<section class="space-y-2" aria-labelledby="home-quick-keywords-heading">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<h3 id="home-quick-keywords-heading" class="lc-text-muted text-xs font-medium">
										빠른 키워드
									</h3>
									{#if quickKeywords?.sourceNoticeCount}
										<p class="lc-text-muted text-[11px]">
											최근 {quickKeywords.sourceNoticeCount.toLocaleString('ko-KR')}건 기준
											{#if quickKeywordUpdatedLabel}
												· {quickKeywordUpdatedLabel} 갱신
											{/if}
										</p>
									{/if}
								</div>
								<div class="flex flex-wrap gap-2" data-testid="home-quick-keywords">
									{#each heroSearchSuggestions as suggestion (suggestion)}
										<a
											href={buildQuickSearchHref(suggestion)}
											data-testid={`home-quick-keyword-${suggestion}`}
											class="lc-home-search-chip rounded-full px-3 py-2 text-sm font-medium"
										>
											{suggestion}
										</a>
									{/each}
								</div>
							</section>

							<div
								class="lc-home-search-loading-shell"
								class:is-active={isQuickSearchLoading}
								role="status"
								aria-live="polite"
							>
								<span class="sr-only">불러오는 중...</span>
								<div class="lc-loading-track h-1.5 w-full overflow-hidden rounded-full">
									<div class="lc-loading-fill loading-slide h-full w-1/3 rounded-full"></div>
								</div>
							</div>
						</div>
					</section>

					<nav aria-label="홈 섹션 바로가기" class="sr-only" data-testid="home-section-navigation">
						<ul>
							<li><a href="#home-overview">소개</a></li>
							<li><a href="#home-quick-search">빠른 검색</a></li>
							<li><a href="#recent-notices">최근 입법예고</a></li>
						</ul>
					</nav>

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
			<section
				id="recent-notices"
				aria-labelledby="recent-notices-heading"
				data-testid="recent-notices-region"
				class="lc-defer-render"
			>
				<h2 id="recent-notices-heading" class="sr-only">최근 입법예고</h2>
				<RecentNotices notices={recentNotices} {stats} />
			</section>
		</div>
	</main>
</div>

<style>
	:global(.group:hover .transition-colors) {
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
