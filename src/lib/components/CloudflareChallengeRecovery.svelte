<script lang="ts">
	import {
		CF_CHALLENGE_MARK_KEY,
		CF_RELOAD_GUARD_KEY
	} from '$lib/utils/cloudflare-challenge';
	import { onMount } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

	let { status, isVisible = $bindable(false) }: { status: number; isVisible?: boolean } = $props();

	const CF_RELOAD_COOLDOWN_MS = 20_000;
	const CF_CHALLENGE_MARK_WINDOW_MS = 30_000;
	const CF_RELOAD_DELAY_MS = 500;

	let isAutoReloadPending = $state(false);

	function handleManualRefresh() {
		window.location.reload();
	}

	onMount(() => {
		if (!isFinite(status) || status < 400) {
			return;
		}

		const recentDetectedAt = Number(window.sessionStorage.getItem(CF_CHALLENGE_MARK_KEY) || '0');
		const hasRecentChallengeDetection =
			Number.isFinite(recentDetectedAt) &&
			Date.now() - recentDetectedAt < CF_CHALLENGE_MARK_WINDOW_MS;

		if (!hasRecentChallengeDetection) {
			return;
		}

		isVisible = true;

		const now = Date.now();
		const previous = Number(window.sessionStorage.getItem(CF_RELOAD_GUARD_KEY) || '0');

		if (Number.isFinite(previous) && now - previous < CF_RELOAD_COOLDOWN_MS) {
			return;
		}

		window.sessionStorage.setItem(CF_RELOAD_GUARD_KEY, String(now));
		isAutoReloadPending = true;

		const timer = window.setTimeout(() => {
			window.location.reload();
		}, CF_RELOAD_DELAY_MS);

		return () => {
			window.clearTimeout(timer);
		};
	});
</script>

{#if isVisible}
	<section class="lc-panel-hero w-full rounded-2xl border p-6 shadow-xl sm:p-10">
		<div
			class="lc-banner-warning mb-5 inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="mr-2 h-3.5 w-3.5" />
			보안 확인
		</div>

		<h1 class="lc-text-primary text-2xl leading-tight font-bold sm:text-3xl">
			보안 확인 챌린지를 처리하는 중입니다
		</h1>
		<p class="lc-text-secondary mt-2 text-sm leading-relaxed sm:text-base">
			{#if isAutoReloadPending}
				잠시 후 페이지가 자동으로 새로고침됩니다.
			{:else}
				자동 새로고침을 준비하는 중입니다.
			{/if}
		</p>
		<p class="lc-text-secondary mt-2 text-sm leading-relaxed sm:text-base">
			잠시 후에도 변화가 없으면 아래 버튼으로 직접 새로고침해 주세요.
		</p>

		<div class="mt-8 flex flex-wrap gap-3">
			<button
				type="button"
				onclick={handleManualRefresh}
				class="lc-button-primary cursor-pointer inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold"
			>
				지금 새로고침
			</button>
			<a
				href="/"
				class="lc-button-neutral inline-flex items-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				메인으로 이동
			</a>
		</div>
	</section>
{/if}
