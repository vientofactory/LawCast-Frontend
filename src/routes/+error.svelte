<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faCompass, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

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
