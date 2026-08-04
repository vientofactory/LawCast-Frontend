<script lang="ts">
	import '../app.css';
	import { env } from '$env/dynamic/public';
	import Footer from '$lib/components/Footer.svelte';
	import {
		CF_CHALLENGE_MARK_KEY,
		CF_RELOAD_GUARD_KEY,
		isChallengeStatus,
		isCloudflareChallengeHeader,
		isJsonContentType,
		isUnderAttackReloadEnabled
	} from '$lib/utils/cloudflare-challenge';
	import { onMount } from 'svelte';
	import NProgress from 'nprogress';
	import { page } from '$app/state';
	import { navigating } from '$app/state';
	import { config } from '@fortawesome/fontawesome-svg-core';

	const CF_RELOAD_COOLDOWN_MS = 20_000;
	const CF_RELOAD_DELAY_MS = 500;
	const CF_RELOAD_ENABLED = isUnderAttackReloadEnabled(env.PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED);

	function isSvelteKitDataRequest(url: URL): boolean {
		return url.pathname.endsWith('/__data.json');
	}

	function normalizePathname(pathname: string): string {
		return pathname.replace(/\/+$|^$/g, '') ? `/${pathname.replace(/^\/+|\/+$/g, '')}` : '/';
	}

	function getRoutePathFromDataRequestPath(pathname: string): string | null {
		if (!pathname.endsWith('/__data.json')) {
			return null;
		}

		const routePath = pathname.slice(0, -'/__data.json'.length);
		return normalizePathname(routePath);
	}

	config.autoAddCss = false;

	NProgress.configure({ showSpinner: false });

	$effect(() => {
		if (navigating.to) {
			NProgress.start();
		} else {
			NProgress.done();
		}
	});

	let { children } = $props();
	const routePath = $derived(page.url.pathname);
	const routeId = $derived(
		routePath === '/' ? 'home' : routePath.replace(/^\//, '').replace(/[/]+/g, '-')
	);

	onMount(() => {
		if (!CF_RELOAD_ENABLED) {
			return;
		}

		const originalFetch = window.fetch.bind(window);
		let reloadScheduled = false;
		let reloadTimer: number | null = null;

		const scheduleReload = () => {
			if (reloadScheduled) {
				return;
			}

			const now = Date.now();
			const previous = Number(window.sessionStorage.getItem(CF_RELOAD_GUARD_KEY) || '0');
			if (Number.isFinite(previous) && now - previous < CF_RELOAD_COOLDOWN_MS) {
				return;
			}

			reloadScheduled = true;
			window.sessionStorage.setItem(CF_RELOAD_GUARD_KEY, String(now));
			window.sessionStorage.setItem(CF_CHALLENGE_MARK_KEY, String(now));
			reloadTimer = window.setTimeout(() => {
				window.location.reload();
			}, CF_RELOAD_DELAY_MS);
		};

		const patchedFetch: typeof window.fetch = async (input, init) => {
			const response = await originalFetch(input, init);

			try {
				const rawUrl =
					typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
				const requestUrl = new URL(rawUrl, window.location.href);

				if (requestUrl.origin !== window.location.origin || !isSvelteKitDataRequest(requestUrl)) {
					return response;
				}

				const activeNavigationPath = navigating.to
					? normalizePathname(navigating.to.url.pathname)
					: null;
				const requestRoutePath = getRoutePathFromDataRequestPath(requestUrl.pathname);

				// Ignore prefetch/background data loads. Only react to active page navigation data fetches.
				if (
					!activeNavigationPath ||
					!requestRoutePath ||
					requestRoutePath !== activeNavigationPath
				) {
					return response;
				}

				if (!isChallengeStatus(response.status)) {
					return response;
				}

				if (isCloudflareChallengeHeader(response)) {
					scheduleReload();
					return response;
				}

				const contentType = response.headers.get('content-type') || '';
				if (isJsonContentType(contentType)) {
					return response;
				}

				// __data.json should be JSON; non-JSON on challenge statuses is treated as challenge response.
				scheduleReload();
			} catch {
				// Ignore detection failures and preserve normal fetch behavior.
			}

			return response;
		};

		window.fetch = patchedFetch;

		return () => {
			window.fetch = originalFetch;
			if (reloadTimer !== null) {
				window.clearTimeout(reloadTimer);
			}
		};
	});
</script>

<svelte:head>
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta property="og:site_name" content="LawCast" />
	<meta property="og:locale" content="ko_KR" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-[var(--lc-surface-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--lc-text-accent)] focus:shadow-lg focus:ring-2 focus:ring-[var(--lc-border-strong)] focus:outline-none"
>
	메인 콘텐츠로 건너뛰기
</a>
<div data-route-path={routePath} data-route-id={routeId} data-testid="app-route-container">
	{@render children()}
</div>
<Footer />
