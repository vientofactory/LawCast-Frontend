<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { goto, invalidateAll } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import RateLimitOverlay from '$lib/components/RateLimitOverlay.svelte';
	import WandSparkleLoader from '$lib/components/WandSparkleLoader.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faMagnifyingGlass,
		faWandMagicSparkles,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import { semanticEngineHealth } from '$lib/api/client';
	import { RetryCountdown } from '$lib/utils/retry-countdown.util';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import type { SemanticEngineHealthResponse } from '$lib/types/api';
	import {
		SEMANTIC_MAX_QUERY_LENGTH,
		SEMANTIC_SEARCH_QUERY_PARAM,
		formatSimilarityPercent,
		parseSemanticSearchQuery
	} from '$lib/utils/semantic-search';
	import type { PageData } from './$types';

	// Maximum length of a query string.
	const MAX_QUERY_LENGTH = SEMANTIC_MAX_QUERY_LENGTH;

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let query = $state(data.query);
	// The server load owns every search result: these are derived from its
	// payload rather than filled in by a browser-side API call.
	let response = $derived(data.search);
	let loadError = $derived(data.loadError);
	let hasQuery = $derived(data.query.length > 0);
	// Head metadata: on a result view the query identifies the page, so it feeds
	// the title, description and keywords. `?search=` stays out of the canonical
	// URL the same way /notices canonicalizes its filtered views — the query
	// still travels through every share-facing tag below.
	let pageTitle = $derived(
		hasQuery ? `"${data.query}" 의미 검색 결과 - LawCast` : '의미 검색 - LawCast'
	);
	let pageUrl = $derived(`${page.url.origin}${page.url.pathname}`);
	let pageDescription = $derived(
		hasQuery
			? `"${data.query}" 질문에 대한 의미 검색 결과입니다. 법률안의 제안이유와 주요내용에서 의미가 가까운 입법예고를 찾아드립니다.`
			: '일상 언어로 질문하면 법률안의 제안이유와 주요내용에서 의미가 비슷한 입법예고를 찾아드립니다.'
	);
	let pageKeywords = $derived(
		`의미 검색, 시맨틱 검색, 입법예고 검색, 국회 법률안 검색, 법안 검색${hasQuery ? `, ${data.query}` : ''}`
	);
	// True while SvelteKit is rerunning the server load for a new ?search=,
	// scoped to this route so navigating away does not read as a search.
	let isLoading = $derived(
		navigating !== null && navigating.to?.url.pathname === page.url.pathname
	);
	// Validation feedback stays client-side; backend failures arrive as loadError.
	let error = $state<string | null>(null);
	let dismissedServerError = $state<string | null>(null);
	let serverError = $derived(
		loadError && loadError.retryAfter === undefined && dismissedServerError !== loadError.message
			? loadError.message
			: null
	);
	let displayError = $derived(error ?? serverError);
	let engineHealth = $state<SemanticEngineHealthResponse | null>(null);
	let engineHealthLoading = $state(true);
	let engineHealthError = $state<string | null>(null);
	let engineStatusOpen = $state(false);
	let engineStatusRoot = $state<HTMLDivElement | null>(null);
	let engineStatusDotClass = $derived(
		engineHealthLoading
			? 'lc-dot-warning animate-pulse'
			: engineHealthError
				? 'lc-text-danger bg-current'
				: 'lc-dot-success'
	);
	let rateLimitRetryAfter = $state(0);
	let isRateLimited = $state(false);
	let isRetrying = $state(false);

	// Retrying a 429 means asking the server load to run again: the URL does
	// not change, so invalidateAll() is what re-issues the search.
	const retry = new RetryCountdown(
		async () => {
			await invalidateAll();
		},
		(v) => {
			rateLimitRetryAfter = v;
		},
		(v) => {
			isRetrying = v;
		}
	);
	onDestroy(() => retry.destroy());

	// A 429 from the server load starts the shared countdown overlay; any other
	// loadError (or a clean reload) tears it down again.
	$effect(() => {
		if (data.loadError !== retry.lastSeenError) {
			retry.lastSeenError = data.loadError;
			if (data.loadError?.retryAfter && data.loadError.retryAfter > 0) {
				retry.start(data.loadError.retryAfter);
				isRateLimited = true;
			} else {
				retry.stop();
				isRateLimited = false;
			}
		}
	});

	let isFallbackMode = $derived(response?.mode === 'keyword_fallback');
	// The URL is the source of truth for the query: sharing or reloading the
	// address reproduces the same search, and returning to this page restores
	// whatever was last searched.
	let urlQuery = $derived(
		parseSemanticSearchQuery(page.url.searchParams.get(SEMANTIC_SEARCH_QUERY_PARAM))
	);
	// Compare against the URL value we last wrote, so our own goto does not
	// re-trigger the sync effect below.
	// svelte-ignore state_referenced_locally
	let lastSyncedQuery = data.query;

	// The engine labels unsectioned chunks 'body'; show it as 본문 in the UI.
	function sectionLabel(section: string): string {
		return section === 'body' ? '본문' : section;
	}

	/**
	 * Reflect the current query into `?search=` with replaceState so the URL
	 * stays shareable without flooding the history stack.
	 */
	function syncUrlQuery(next: string) {
		lastSyncedQuery = next;
		if (next === urlQuery) return;
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.set(SEMANTIC_SEARCH_QUERY_PARAM, next);
		goto(`${page.url.pathname}?${params.toString()}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function runSearch() {
		const trimmed = query.trim();
		if (!trimmed) {
			error = '검색어를 입력해 주세요.';
			return;
		}
		if (trimmed.length > MAX_QUERY_LENGTH) {
			error = `검색어는 ${MAX_QUERY_LENGTH}자 이내로 입력해 주세요.`;
			return;
		}
		error = null;
		dismissedServerError = null;
		isRateLimited = false;

		// Submitting the same query again (a retry after an error, say) cannot
		// be expressed as a URL change, so reload the data instead — a goto to
		// the identical URL would not rerun the server load.
		if (trimmed === urlQuery) {
			void invalidateAll();
			return;
		}
		syncUrlQuery(trimmed);
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		runSearch();
	}

	/**
	 * Load the engine status (청크 인덱스 개수·마지막 업데이트·실행 시간)
	 * once per page mount. Failures only affect the status block, never the
	 * search itself.
	 */
	async function loadEngineHealth() {
		engineHealthLoading = true;
		engineHealthError = null;
		try {
			engineHealth = await semanticEngineHealth();
		} catch (caught) {
			engineHealth = null;
			engineHealthError = (caught as Error).message || '엔진 상태를 확인할 수 없습니다.';
		} finally {
			engineHealthLoading = false;
		}
	}

	/**
	 * Close the engine status widget when a click lands outside it, so the
	 * panel behaves like a popover instead of a modal. Clicks on the widget
	 * itself (trigger, panel, close button) are ignored.
	 */
	function handleWindowClick(event: MouseEvent) {
		if (!engineStatusOpen) return;
		const target = event.target;
		if (target instanceof Node && engineStatusRoot?.contains(target)) return;
		engineStatusOpen = false;
	}

	function handleExampleQuery(example: string) {
		query = example;
		runSearch();
	}

	// URL -> form: react to query changes that did not originate from this form
	// (back/forward navigation, a hand-edited address). The server load has
	// already fetched the matching results by then, so only the field follows.
	$effect(() => {
		if (urlQuery === lastSyncedQuery) return;
		lastSyncedQuery = urlQuery;
		query = urlQuery;
		error = null;
		dismissedServerError = null;
	});

	// The alert is shared by validation messages and backend failures, so
	// dismissal has to know which one is on screen.
	function dismissError() {
		if (error) {
			error = null;
			return;
		}
		if (loadError) dismissedServerError = loadError.message;
	}

	onMount(() => {
		// Deep links and no-JS form submits are already served with results by
		// the server load, so the browser only has to pick up the engine status.
		void loadEngineHealth();
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<link rel="canonical" href={pageUrl} />
	<meta name="description" content={pageDescription} />
	<meta name="keywords" content={pageKeywords} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<svelte:window onclick={handleWindowClick} />

<div class="page-shell">
	<Header />

	<main
		id="main-content"
		class="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
		aria-labelledby="semantic-search-page-title"
		data-testid="semantic-search-main"
	>
		<nav class="mb-8 flex items-center space-x-3 text-sm" aria-label="이동 경로">
			<a
				href="/notices"
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2 transition-all duration-200"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				전체 입법예고
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<span class="lc-text-secondary font-semibold">의미 검색</span>
		</nav>

		<section class="lc-panel-card mb-6 rounded-xl border p-6 shadow-sm">
			<div class="flex items-start gap-3">
				<div class="lc-chip-purple mt-0.5 rounded-full p-1.5">
					<FontAwesomeIcon icon={faWandMagicSparkles} class="h-4 w-4" />
				</div>
				<div>
					<h1 id="semantic-search-page-title" class="lc-text-primary text-xl font-bold">
						의미 검색
					</h1>
					<p class="lc-text-secondary mt-1 text-sm">
						키워드가 아니어도 괜찮습니다. "세입자 보호"처럼 일상 언어로 질문하면 제안이유와
						주요내용에서 의미가 비슷한 법률안을 찾아드립니다.
					</p>
				</div>
			</div>

			<form class="mt-5" onsubmit={handleSubmit} data-testid="semantic-search-form">
				<label for="semantic-search-input" class="sr-only">검색어</label>
				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<FontAwesomeIcon
							icon={faMagnifyingGlass}
							class="lc-text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
						/>
						<input
							id="semantic-search-input"
							type="search"
							name="search"
							bind:value={query}
							enterkeyhint="search"
							maxlength={MAX_QUERY_LENGTH}
							placeholder="예: 임대차 계약에서 세입자 보호"
							data-testid="semantic-search-input"
							disabled={isLoading}
							class="lc-input lc-input-focus w-full rounded-lg border py-2 pr-3 pl-10 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
						/>
					</div>
					<button
						type="submit"
						disabled={isLoading}
						data-testid="semantic-search-submit"
						class="lc-button-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if isLoading}
							<FontAwesomeIcon icon={faWandMagicSparkles} class="mr-2 h-4 w-4 lc-wand-glint" />
							검색 중
						{:else}
							검색
						{/if}
					</button>
				</div>
			</form>
		</section>

		{#if displayError}
			<div class="mb-6" data-testid="semantic-search-error">
				<Alert type="error" message={displayError} onDismiss={dismissError} />
			</div>
		{/if}

		{#if hasQuery && isFallbackMode && response}
			<div
				class="lc-banner-warning mb-6 rounded-xl border p-4 shadow-sm"
				data-testid="semantic-search-fallback-banner"
			>
				<div class="flex items-start gap-3">
					<div class="lc-chip-warning mt-0.5 rounded-full p-1.5">
						<FontAwesomeIcon icon={faWandMagicSparkles} class="h-4 w-4" />
					</div>
					<div>
						<p class="lc-text-primary text-sm font-semibold">
							키워드 검색 결과를 표시하고 있습니다
						</p>
						<p class="lc-text-secondary mt-1 text-sm">{response.fallbackReason}</p>
					</div>
				</div>
			</div>
		{/if}

		<section
			class="relative"
			aria-labelledby="semantic-search-results-heading"
			data-testid="semantic-search-results-region"
		>
			<h2 id="semantic-search-results-heading" class="sr-only">의미 검색 결과</h2>
			{#if isLoading}
				<div
					class="lc-empty-state rounded-2xl border p-16 text-center shadow-xl"
					data-testid="semantic-search-loading-state"
				>
					<div class="mb-6 inline-block">
						<WandSparkleLoader />
					</div>
					<p class="lc-text-secondary text-sm">법률안을 읽고 의미를 분석하는 중입니다...</p>
				</div>
			{:else if hasQuery && !isLoading && response && response.results.length === 0}
				<div
					class="lc-empty-state rounded-2xl border p-16 text-center shadow-xl"
					data-testid="semantic-search-empty-state"
				>
					<div class="lc-empty-state-icon mb-6 inline-block rounded-full p-6">
						<FontAwesomeIcon icon={faMagnifyingGlass} class="lc-text-dim h-16 w-16" />
					</div>
					<h3 class="lc-text-primary mb-3 text-2xl font-bold">검색 결과가 없습니다</h3>
					<p class="lc-text-secondary text-sm">다른 표현으로 다시 검색해보세요.</p>
				</div>
			{:else if hasQuery && response && response.results.length > 0}
				<p class="lc-text-secondary mb-3 text-sm" data-testid="semantic-search-results-summary">
					<span class="lc-text-primary font-semibold">{response.query}</span>
					에 대한 {isFallbackMode ? '키워드' : '의미'} 검색 결과
					<span class="lc-text-primary font-semibold"
						>{response.results.length.toLocaleString('ko-KR')}</span
					>건
				</p>
				<div
					class="space-y-4"
					class:opacity-85={isLoading}
					data-testid="semantic-search-results-list"
				>
					{#each response.results as result (result.noticeNum)}
						<article
							aria-labelledby="semantic-result-heading-{result.noticeNum}"
							data-testid={`semantic-result-${result.noticeNum}`}
							class="lc-notice-card lc-notice-border-active rounded-lg border-l-4 p-4 shadow transition-shadow hover:shadow-md sm:p-6"
						>
							<div class="flex flex-wrap items-center gap-2">
								<span
									class="lc-chip-blue inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
								>
									의안번호 {result.noticeNum}
								</span>
								{#if result.score !== null}
									<span
										class="lc-chip-success inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
									>
										유사도 {formatSimilarityPercent(result.score)}
									</span>
								{/if}
								{#if result.section}
									<span
										class="lc-chip-purple inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
									>
										{sectionLabel(result.section)}
									</span>
								{/if}
								{#if result.committee}
									<span
										class="lc-chip-muted inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
									>
										{result.committee}
									</span>
								{/if}
							</div>
							<h3
								id="semantic-result-heading-{result.noticeNum}"
								class="lc-text-primary mt-2 text-lg font-bold"
							>
								<a href={`/notices/${result.noticeNum}`} class="lc-link">
									{result.subject}
								</a>
							</h3>
							{#if result.excerpt}
								<p class="lc-text-secondary mt-2 whitespace-pre-line text-sm">
									{result.excerpt}
								</p>
							{/if}
							<div class="mt-3">
								<a
									href={`/notices/${result.noticeNum}`}
									class="lc-link inline-flex items-center text-sm font-semibold"
									data-testid={`semantic-result-link-${result.noticeNum}`}
								>
									법률안 상세 보기
									<span aria-hidden="true">→</span>
								</a>
							</div>
						</article>
					{/each}
				</div>
				<div class="mt-6 flex justify-center">
					<a
						href={`/notices?search=${encodeURIComponent(response.query)}`}
						class="lc-button-neutral inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200"
						data-testid="semantic-search-keyword-link"
					>
						<FontAwesomeIcon icon={faMagnifyingGlass} class="mr-2 h-4 w-4" />
						전체 입법예고에서 키워드 검색하기
					</a>
				</div>
			{:else if !hasQuery}
				<div
					class="lc-empty-state rounded-2xl border p-16 text-center shadow-xl"
					data-testid="semantic-search-initial-state"
				>
					<div class="lc-empty-state-icon mb-6 inline-block rounded-full p-6">
						<FontAwesomeIcon icon={faWandMagicSparkles} class="lc-text-dim h-16 w-16" />
					</div>
					<h3 class="lc-text-primary mb-3 text-2xl font-bold">무엇이든 물어보세요</h3>
					<p class="lc-text-secondary text-sm">아래 예시처럼 일상 언어로 질문해 보세요.</p>
					<div class="mt-5 flex flex-wrap justify-center gap-2">
						<!-- Drawn server-side: the SSR HTML already shows exactly these chips. -->
						{#each data.exampleQueries as example (example)}
							<button
								type="button"
								class="lc-button-neutral rounded-lg border px-3 py-2 text-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
								onclick={() => handleExampleQuery(example)}
								data-testid="semantic-search-example"
							>
								{example}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	</main>

	<!-- Engine status: a small fixed corner control so casual readers skip
	     it, while the full details stay one click away. -->
	<div
		bind:this={engineStatusRoot}
		class="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2"
		data-testid="semantic-search-engine-status"
	>
		{#if engineStatusOpen}
			<div
				id="semantic-engine-status-panel"
				class="lc-panel-card w-72 rounded-xl border p-4 shadow-lg"
				role="dialog"
				aria-labelledby="semantic-engine-status-heading"
				data-testid="semantic-search-engine-status-panel"
				transition:fly={{ y: 8, duration: 180, opacity: 0 }}
			>
				<div class="flex items-center justify-between">
					<h2 id="semantic-engine-status-heading" class="lc-text-primary text-sm font-semibold">
						엔진 상태
					</h2>
					<button
						type="button"
						class="lc-text-dim cursor-pointer rounded p-1 transition-opacity hover:opacity-70"
						aria-label="엔진 상태 닫기"
						data-testid="semantic-search-engine-status-close"
						onclick={() => (engineStatusOpen = false)}
					>
						<FontAwesomeIcon icon={faXmark} class="h-3.5 w-3.5" />
					</button>
				</div>
				{#if engineHealthLoading}
					<p
						class="lc-text-secondary mt-2 text-sm"
						role="status"
						aria-live="polite"
						data-testid="semantic-search-engine-status-loading"
					>
						엔진 상태를 확인하는 중...
					</p>
				{:else if engineHealthError}
					<p class="lc-text-danger mt-2 text-sm" data-testid="semantic-search-engine-status-error">
						{engineHealthError}
					</p>
				{:else if engineHealth}
					<dl
						class="mt-2 flex flex-col gap-2 text-sm"
						data-testid="semantic-search-engine-status-values"
					>
						<div>
							<dt class="lc-text-dim text-xs">청크 인덱스 개수</dt>
							<dd class="lc-text-primary font-semibold" data-testid="semantic-search-engine-chunks">
								{engineHealth.indexedChunks.toLocaleString('ko-KR')}
							</dd>
						</div>
						<div>
							<dt class="lc-text-dim text-xs">마지막 업데이트</dt>
							<dd class="lc-text-primary" data-testid="semantic-search-engine-last-update">
								{engineHealth.lastUpdateAt
									? formatDateTimeKST(engineHealth.lastUpdateAt)
									: '기록 없음'}
							</dd>
						</div>
						<div>
							<dt class="lc-text-dim text-xs">마지막 업데이트 실행 시간</dt>
							<dd class="lc-text-primary" data-testid="semantic-search-engine-last-update-run">
								{engineHealth.lastUpdateTriggeredAt
									? formatDateTimeKST(engineHealth.lastUpdateTriggeredAt)
									: '기록 없음'}
							</dd>
						</div>
					</dl>
				{/if}
			</div>
		{/if}
		<button
			type="button"
			class="lc-panel-card flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm opacity-70 transition-all duration-200 hover:-translate-y-0.5 hover:opacity-100"
			aria-expanded={engineStatusOpen}
			aria-controls={engineStatusOpen ? 'semantic-engine-status-panel' : undefined}
			data-testid="semantic-search-engine-status-trigger"
			onclick={() => (engineStatusOpen = !engineStatusOpen)}
		>
			<span class={`h-1.5 w-1.5 rounded-full ${engineStatusDotClass}`} aria-hidden="true"></span>
			<span class="lc-text-secondary">엔진 상태</span>
		</button>
	</div>

	<RateLimitOverlay
		visible={isRateLimited}
		retryAfter={rateLimitRetryAfter}
		isRetrying={isLoading || isRetrying}
		onRetry={() => {
			isRateLimited = false;
			void retry.retry();
		}}
	/>
</div>
