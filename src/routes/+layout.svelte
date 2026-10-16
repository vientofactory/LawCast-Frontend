<script lang="ts">
	import '../app.css';
	import CloudflareChallengeReload from '$lib/components/CloudflareChallengeReload.svelte';
	import CookieConsentBanner from '$lib/components/CookieConsentBanner.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import NProgress from 'nprogress';
	import { page } from '$app/state';
	import { navigating } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { GTM_CONTAINER_ID, pushGtmPageView } from '$lib/utils/gtm';
	import { config } from '@fortawesome/fontawesome-svg-core';

	config.autoAddCss = false;

	NProgress.configure({ showSpinner: false });

	$effect(() => {
		if (navigating.to) {
			NProgress.start();
		} else {
			NProgress.done();
		}
	});

	// Report client-side navigations to GTM once the container loads on
	// consent. Skipped entirely when no container ID is configured.
	afterNavigate((navigation) => {
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

	// GTM (gtag.js) is rendered into the SSR response head so Tag Assistant
	// verifies the container without executing the JS bundle. The ID is baked
	// at build time (`PUBLIC_GTM_CONTAINER_ID`) and validated here so an
	// unexpected value never becomes executable markup.
	const isGtmEnabled = GTM_CONTAINER_ID !== '' && /^[A-Za-z0-9_-]+$/.test(GTM_CONTAINER_ID);
	// Inline snippet seeds Consent Mode defaults from the stored decision
	// before `gtag('config', ...)` runs, preserving the previous Basic-mode
	// ordering where the default was pushed before the container loaded.
	// Tag open brackets are written as \u003c so the Svelte compiler does
	// not mistake the markup string for real elements; at runtime \u003c
	// decodes to `<`, producing the exact snippet requested. Raw markup
	// injection is required here: Svelte strips HTML comments and does not
	// interpolate inside inline `<script>` bodies, so real head elements
	// cannot reproduce the requested snippet bytes.
	const gtmHeadHtml = isGtmEnabled
		? `\u003c!-- Google tag (gtag.js) -->\n\u003cscript async src="https://www.googletagmanager.com/gtag/js?id=${GTM_CONTAINER_ID}">\u003c/script>\n\u003cscript>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}try{var s=window.localStorage.getItem('lawcast-cookie-consent')==='accepted'?'granted':'denied';dataLayer.push(['consent','default',{ad_storage:s,ad_user_data:s,ad_personalization:s,analytics_storage:s,wait_for_update:500}]);}catch(e){dataLayer.push(['consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500}]);}gtag('js',new Date());gtag('config','${GTM_CONTAINER_ID}');\u003c/script>`
		: '';
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
