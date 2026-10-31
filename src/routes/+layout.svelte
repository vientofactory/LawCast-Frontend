<script lang="ts">
	import '../app.css';
	import PwaInstallPrompt from '$lib/components/PwaInstallPrompt.svelte';
	import CloudflareChallengeReload from '$lib/components/CloudflareChallengeReload.svelte';
	import CookieConsentBanner from '$lib/components/CookieConsentBanner.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import NProgress from 'nprogress';
	import { page } from '$app/state';
	import { navigating } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { GTM_CONTAINER_ID, pushGtmPageView } from '$lib/utils/gtm';
	import { buildGtmHeadHtml } from '$lib/utils/gtm-bootstrap';
	import { config } from '@fortawesome/fontawesome-svg-core';

	config.autoAddCss = false;

	NProgress.configure({
		showSpinner: false,
		barSelector: '.bar',
		template:
			'<div role="region" aria-label="페이지 로딩 상태"><div class="bar" role="progressbar" aria-label="페이지 불러오는 중" data-testid="navigation-progress"><div class="peg"></div></div></div>'
	});

	$effect(() => {
		if (navigating.to) {
			NProgress.start();
		} else {
			NProgress.done();
		}
	});

	afterNavigate((navigation) => {
		// Let SvelteKit reset normal navigation and honor explicit noScroll options.
		// Override history restoration only; hash destinations keep native behavior.
		if (navigation.type === 'popstate' && !navigation.to?.url.hash) {
			window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
		}

		// Report initial and SPA page views only after analytics consent.
		if (!GTM_CONTAINER_ID) return;
		const path = navigation.to?.url.pathname
			? `${navigation.to.url.pathname}${navigation.to.url.search}`
			: window.location.pathname + window.location.search;
		pushGtmPageView(path);
	});

	let {
		children,
		data = { frontendVersion: 'unknown', backendVersion: 'unknown', urgentNotice: null }
	} = $props();
	const routePath = $derived(page.url.pathname);
	const routeId = $derived(
		routePath === '/' ? 'home' : routePath.replace(/^\//, '').replace(/[/]+/g, '-')
	);

	// Consent defaults and returning-visitor updates must precede GTM bootstrap.
	const isGtmEnabled = /^GTM-[A-Za-z0-9]+$/.test(GTM_CONTAINER_ID);
	const gtmHeadHtml = buildGtmHeadHtml(GTM_CONTAINER_ID);
</script>

<svelte:head>
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta property="og:site_name" content="LawCast" />
	<meta property="og:locale" content="ko_KR" />
	<meta name="twitter:card" content="summary_large_image" />
	{#if isGtmEnabled}
		<!-- The markup string is built only from the allowlist-validated
			container ID above plus static inline JS, so raw HTML injection is
			safe here. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html gtmHeadHtml}
	{/if}
</svelte:head>

<CloudflareChallengeReload {navigating} />

<!-- A noscript tracking iframe cannot read the visitor's stored consent. -->

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-[var(--lc-surface-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--lc-text-accent)] focus:shadow-lg focus:ring-2 focus:ring-[var(--lc-border-strong)] focus:outline-none"
>
	메인 콘텐츠로 건너뛰기
</a>
<div data-route-path={routePath} data-route-id={routeId} data-testid="app-route-container">
	{@render children()}
</div>
<Footer frontendVersion={data.frontendVersion} backendVersion={data.backendVersion} />
<CookieConsentBanner />

<PwaInstallPrompt />
