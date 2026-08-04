<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faCompass, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

	const CF_RELOAD_GUARD_KEY = 'lawcast:cf-under-attack-reload-at';
	const CF_RELOAD_COOLDOWN_MS = 20_000;
	const CF_RELOAD_DELAY_MS = 500;
	const CF_CHALLENGE_ERROR_CODE = 'lc_cf_challenge_detected';
	const CF_RELOAD_ENABLED = ['1', 'true', 'yes', 'on'].includes(
		(env.PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED || '').trim().toLowerCase()
	);

	function shouldReloadForCloudflareChallenge(status: number, error: App.Error | null): boolean {
		const message = (error?.message ?? '').toLowerCase();

		const cloudflareMessageHints = [
			CF_CHALLENGE_ERROR_CODE,
			'cloudflare',
			'under attack',
			'just a moment',
			'attention required',
			'cf-ray',
			'checking your browser',
			'/cdn-cgi/challenge-platform',
			'__cf_chl_',
			'cf_chl_',
			'cf_clearance',
			'challenge-platform'
		];

		const jsonParseHints = ['unexpected token <', 'invalid json', 'not valid json'];
		const statusHint = status === 403 || status === 429 || status === 503 || status === 520;

		const hasCloudflareHint = cloudflareMessageHints.some((hint) => message.includes(hint));
		const hasJsonParseHint = jsonParseHints.some((hint) => message.includes(hint));

		return hasCloudflareHint || (statusHint && hasJsonParseHint);
	}

	const status = $derived(page.status);
	const appError = $derived(page.error as App.Error | null);
	const isNotFound = $derived(status === 404);
	const title = $derived(
		isNotFound ? '요청한 페이지를 찾을 수 없습니다' : '페이지를 불러오지 못했습니다'
	);
	const description = $derived(
		isNotFound
			? appError?.message || '요청한 입법예고 원문 또는 페이지가 존재하지 않거나 삭제되었습니다.'
			: appError?.message || '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
	);

	onMount(() => {
		if (!CF_RELOAD_ENABLED) {
			return;
		}

		const challengeLocationHints = `${window.location.pathname}${window.location.search}`
			.toLowerCase()
			.trim();
		const hasRuntimeChallengeHint =
			challengeLocationHints.includes('/cdn-cgi/challenge-platform') ||
			challengeLocationHints.includes('__cf_chl_') ||
			challengeLocationHints.includes('cf_chl_');

		if (!hasRuntimeChallengeHint && !shouldReloadForCloudflareChallenge(status, appError)) {
			return;
		}

		const now = Date.now();
		const previous = Number(window.sessionStorage.getItem(CF_RELOAD_GUARD_KEY) || '0');

		if (Number.isFinite(previous) && now - previous < CF_RELOAD_COOLDOWN_MS) {
			return;
		}

		window.sessionStorage.setItem(CF_RELOAD_GUARD_KEY, String(now));

		// Give the browser a brief moment to persist Cloudflare cookies before reload.
		const timer = window.setTimeout(() => {
			window.location.reload();
		}, CF_RELOAD_DELAY_MS);

		return () => {
			window.clearTimeout(timer);
		};
	});
</script>

<svelte:head>
	<title>{status} | {title} - LawCast</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page-shell">
	<Header />

	<main
		class="mx-auto flex min-h-[calc(100vh-72px)] max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8"
	>
		<section class="lc-panel-hero w-full rounded-2xl border p-6 shadow-xl sm:p-10">
			<div
				class="lc-banner-warning mb-5 inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
			>
				<FontAwesomeIcon icon={faTriangleExclamation} class="mr-2 h-3.5 w-3.5" />
				HTTP {status}
			</div>

			<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 class="lc-text-primary text-2xl leading-tight font-bold sm:text-3xl">{title}</h1>
					<p class="lc-text-secondary mt-2 text-sm leading-relaxed sm:text-base">{description}</p>
				</div>
			</div>

			<div class="mt-8 flex flex-wrap gap-3">
				<a
					href="/notices"
					class="lc-button-primary inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold"
				>
					<FontAwesomeIcon icon={faCompass} class="mr-2 h-4 w-4" />
					전체 입법예고로 이동
				</a>
				<a
					href="/"
					class="lc-button-neutral inline-flex items-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
				>
					<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
					메인으로 이동
				</a>
			</div>
		</section>
	</main>
</div>
