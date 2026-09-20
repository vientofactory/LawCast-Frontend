<script lang="ts">
	import { env } from '$env/dynamic/public';
	import {
		CF_CHALLENGE_MARK_KEY,
		CF_RELOAD_GUARD_KEY,
		isChallengeStatus,
		isCloudflareChallengeHeader,
		isJsonContentType,
		isUnderAttackReloadEnabled
	} from '$lib/utils/cloudflare-challenge';
	import { onMount } from 'svelte';

	let { navigating }: { navigating: { to: { url: { pathname: string } } | null } } = $props();

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
