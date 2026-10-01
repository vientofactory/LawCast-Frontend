<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import RateLimitOverlay from '$lib/components/RateLimitOverlay.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faMagnifyingGlass,
		faSpinner,
		faWandMagicSparkles
	} from '@fortawesome/free-solid-svg-icons';
	import { getRateLimitRetryAfter, isRateLimitError, semanticSearch } from '$lib/api/client';
	import type { SemanticSearchResponse } from '$lib/types/api';
	import {
		SEMANTIC_MAX_QUERY_LENGTH,
		SEMANTIC_SEARCH_QUERY_PARAM,
		formatSimilarityPercent,
		parseSemanticSearchQuery
	} from '$lib/utils/semantic-search';
	import type { PageData } from './$types';

	const DEFAULT_K = 10;
	const MAX_QUERY_LENGTH = SEMANTIC_MAX_QUERY_LENGTH;
	const EXAMPLE_QUERIES = ['해외직구할 때 관세 얼마나 내야 해?', '시골에 병원이 너무 없어요'];

	let { data }: { data: PageData } = $props();

	// The loaded URL query seeds the form exactly once, at mount.
	// svelte-ignore state_referenced_locally
	let query = $state(data.query);
	let response = $state<SemanticSearchResponse | null>(null);
	let isLoading = $state(false);
	let hasSearched = $state(false);
	let error = $state<string | null>(null);
	let rateLimitRetryAfter = $state(0);
	let isRateLimited = $state(false);

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
	let searchSequence = 0;

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

	async function runSearch() {
		const trimmed = query.trim();
		if (!trimmed) {
			error = '검색어를 입력해 주세요.';
			return;
		}
		if (trimmed.length > MAX_QUERY_LENGTH) {
			error = `검색어는 ${MAX_QUERY_LENGTH}자 이내로 입력해 주세요.`;
			return;
		}

		syncUrlQuery(trimmed);

		// Only the latest request may touch the UI; superseded responses are dropped.
		const sequence = ++searchSequence;
		isLoading = true;
		hasSearched = true;
		error = null;
		isRateLimited = false;
		try {
			const result = await semanticSearch({ query: trimmed, k: DEFAULT_K });
			if (sequence !== searchSequence) return;
			response = result;
		} catch (caught) {
			if (sequence !== searchSequence) return;
			if (isRateLimitError(caught)) {
				rateLimitRetryAfter = getRateLimitRetryAfter(caught);
				isRateLimited = true;
			} else {
				response = null;
				error =
					(caught as Error).message ||
					'의미 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
			}
		} finally {
			if (sequence === searchSequence) isLoading = false;
		}
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		runSearch();
	}

	function handleExampleQuery(example: string) {
		query = example;
		runSearch();
	}

	// URL -> page state: react to query changes that did not originate from
	// this form (back/forward navigation, a hand-edited address).
	$effect(() => {
		if (urlQuery === lastSyncedQuery) return;
		lastSyncedQuery = urlQuery;
		query = urlQuery;
		if (urlQuery) {
			runSearch();
		} else {
			searchSequence += 1;
			response = null;
			hasSearched = false;
			isLoading = false;
			error = null;
		}
	});

	onMount(() => {
		// Deep link (?search=...): reproduce the search on load. This also
		// covers the no-JS form submit fallback, which round-trips through
		// the same parameter.
		if (data.query) runSearch();
	});
</script>

<svelte:head>
	<title>의미 검색 - LawCast</title>
	<meta
		name="description"
		content="일상 언어로 질문하면 법률안의 제안이유와 주요내용에서 의미가 비슷한 입법예고를 찾아드립니다."
	/>
	<meta
		name="twitter:description"
		content="일상 언어로 질문하면 법률안의 제안이유와 주요내용에서 의미가 비슷한 입법예고를 찾아드립니다."
	/>
</svelte:head>

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
							class="lc-input lc-input-focus w-full rounded-lg border py-2 pr-3 pl-10 text-sm shadow-sm"
						/>
					</div>
					<button
						type="submit"
						disabled={isLoading}
						data-testid="semantic-search-submit"
						class="lc-button-primary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if isLoading}
							<FontAwesomeIcon icon={faSpinner} class="mr-2 h-4 w-4 animate-spin" />
							검색 중
						{:else}
							검색
						{/if}
					</button>
				</div>
			</form>

			{#if isLoading}
				<div
					class="lc-loading-track mt-3 h-1 w-full overflow-hidden rounded-full"
					role="status"
					aria-live="polite"
				>
					<span class="sr-only">의미 검색 중...</span>
					<div class="lc-loading-fill loading-slide h-full w-1/3 rounded-full"></div>
				</div>
			{/if}
		</section>

		{#if error}
			<div class="mb-6" data-testid="semantic-search-error">
				<Alert type="error" message={error} onDismiss={() => (error = null)} />
			</div>
		{/if}

		{#if hasSearched && isFallbackMode && response}
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
			{#if isLoading && !hasSearched}
				<div
					class="lc-empty-state rounded-2xl border p-16 text-center shadow-xl"
					data-testid="semantic-search-loading-state"
				>
					<div class="lc-empty-state-icon mb-6 inline-block rounded-full p-6">
						<FontAwesomeIcon icon={faSpinner} class="lc-text-dim h-16 w-16 animate-spin" />
					</div>
					<p class="lc-text-secondary text-sm">법률안을 읽고 의미를 분석하는 중입니다...</p>
				</div>
			{:else if hasSearched && !isLoading && response && response.results.length === 0}
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
			{:else if hasSearched && response && response.results.length > 0}
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
			{:else if !hasSearched}
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
						{#each EXAMPLE_QUERIES as example (example)}
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

	<RateLimitOverlay
		visible={isRateLimited}
		retryAfter={rateLimitRetryAfter}
		isRetrying={isLoading}
		onRetry={() => {
			isRateLimited = false;
			runSearch();
		}}
	/>
</div>
