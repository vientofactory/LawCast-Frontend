<script lang="ts">
	import * as env from '$app/env/public';
	import { page } from '$app/state';
	import {
		isChallengeStatus,
		isUnderAttackReloadEnabled
	} from '#lib/utils/cloudflare-challenge.ts';
	import CloudflareChallengeRecovery from '#lib/components/CloudflareChallengeRecovery.svelte';
	import { getFailureKind, FAILURE_PRESENTATION } from '#lib/utils/request-failure.ts';
	import Header from '#lib/components/Header.svelte';
	import ServerOfflineState from '#lib/components/ServerOfflineState.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faCompass, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

	const CF_RELOAD_ENABLED = isUnderAttackReloadEnabled(env.PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED);

	const status = $derived(page.status);
	const appError = $derived(page.error as App.Error | null);
	const isConnectionOffline = $derived(appError?.kind === 'network');
	const kind = $derived(getFailureKind({ status }));
	const presentation = $derived(FAILURE_PRESENTATION[kind]);
	const isNotFound = $derived(status === 404);
	const title = $derived(isNotFound ? '요청한 페이지를 찾을 수 없습니다' : presentation.title);
	const description = $derived(
		isNotFound
			? appError?.message || '요청한 입법예고 원문 또는 페이지가 존재하지 않거나 삭제되었습니다.'
			: appError?.message && /[가-힣]/.test(appError.message)
				? appError.message
				: presentation.guidance
	);

	let isChallengeRecoveryView = $state(false);
</script>

<SeoHead
	title={isChallengeRecoveryView ? '보안 확인 중' : `${status} | ${title}`}
	{description}
	url={`${page.url.origin}${page.url.pathname}`}
	keywords="404 페이지 없음, 입법예고 아카이브 오류, LawCast"
/>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="lc-page-shell">
	{#if !isConnectionOffline}<Header />{/if}

	<main
		id="main-content"
		class={isConnectionOffline
			? 'lc-main lc-main--form flex min-h-svh items-center'
			: 'mx-auto flex min-h-[calc(100vh-72px)] max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8'}
	>
		{#if CF_RELOAD_ENABLED && isChallengeStatus(status)}
			<CloudflareChallengeRecovery {status} bind:isVisible={isChallengeRecoveryView} />
		{/if}

		{#if !isChallengeRecoveryView && isConnectionOffline}
			<div class="w-full">
				<ServerOfflineState
					error={{ kind: 'network', message: description }}
					onRetry={() => window.location.reload()}
					headingLevel={1}
				/>
			</div>
		{:else if !isChallengeRecoveryView}
			<section
				class="lc-panel-hero w-full rounded-2xl border p-6 shadow-xl sm:p-10"
				data-failure-kind={kind}
			>
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
					{#if presentation.retryable && status !== 429}
						<button
							type="button"
							onclick={() => window.location.reload()}
							class="lc-button-neutral min-h-11 cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-semibold"
							>다시 시도</button
						>
					{/if}
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
		{/if}
	</main>
</div>
