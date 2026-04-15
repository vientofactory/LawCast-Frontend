<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import { openExternalLink } from '$lib/utils/helpers';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBell,
		faExternalLink,
		faFileLines,
		faScaleBalanced,
		faTriangleExclamation,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import type { NoticeDetail } from '$lib/types/api';

	export let data: { detail: NoticeDetail };

	$: detail = data.detail;

	function buildExcerpt(content: string, maxLength = 180): string {
		const normalized = content.replace(/\s+/g, ' ').trim();

		if (normalized.length <= maxLength) {
			return normalized;
		}

		return `${normalized.slice(0, maxLength)}...`;
	}

	$: pageTitle = `${detail.notice.subject} - 제안이유 및 주요내용 원문 | LawCast`;
	$: pageDescription = buildExcerpt(detail.originalContent.proposalReason);

	$: shouldShowAIBriefing =
		detail.notice.aiSummaryStatus === 'ready' || detail.notice.aiSummaryStatus === 'unavailable';
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta
		name="keywords"
		content="법률안 원문, 제안이유 및 주요내용, 입법예고 상세, 국회 법안, 의안번호"
	/>
	<meta name="robots" content="index, follow, max-image-preview:large" />

	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="LawCast" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-sky-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
		<nav class="mb-8 flex items-center space-x-3 text-sm">
			<a
				href="/notices"
				class="flex items-center rounded-lg border border-gray-200/50 bg-white/70 px-3 py-2 text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-gray-800"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				전체 입법예고
			</a>
			<span class="text-gray-400">/</span>
			<span class="font-semibold text-gray-700">법률안 원문 조회</span>
		</nav>

		<section
			class="mb-6 rounded-2xl border border-white/50 bg-white/75 p-6 shadow-lg backdrop-blur-sm"
		>
			<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
				<div>
					<div
						class="mb-2 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
					>
						<FontAwesomeIcon icon={faScaleBalanced} class="mr-1.5 h-3.5 w-3.5" />
						의안번호 {detail.notice.num}
					</div>
					<h1 class="text-2xl leading-snug font-bold text-gray-900">{detail.notice.subject}</h1>
					<div class="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
						<span class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1">
							<FontAwesomeIcon icon={faUser} class="mr-1.5 h-3.5 w-3.5" />
							{detail.notice.proposerCategory}
						</span>
						<span class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1">
							<FontAwesomeIcon icon={faBell} class="mr-1.5 h-3.5 w-3.5" />
							{detail.notice.committee}
						</span>
					</div>
				</div>
				<button
					on:click={() => openExternalLink(detail.notice.link)}
					class="inline-flex cursor-pointer items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
				>
					<FontAwesomeIcon icon={faExternalLink} class="mr-2 h-4 w-4" />
					국회 페이지 열기
				</button>
			</div>

			{#if shouldShowAIBriefing}
				<AIBriefingCard
					summary={detail.notice.aiSummary ?? null}
					status={detail.notice.aiSummaryStatus ?? 'unavailable'}
				/>
			{/if}
		</section>

		<section
			class="mb-6 rounded-xl border border-amber-200/80 bg-linear-to-r from-amber-50 to-orange-50 p-4 shadow-sm"
		>
			<div class="flex items-start gap-3">
				<div class="mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700">
					<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
				</div>
				<div>
					<p class="text-sm font-semibold text-amber-900">안내</p>
					<p class="mt-1 text-sm leading-relaxed text-amber-800/90">
						AI 요약은 참고용이며 오류가 있을 수 있습니다. 아래 원문(제안이유 및 주요내용)을 최종
						기준으로 확인해주세요.
					</p>
				</div>
			</div>
		</section>

		<section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="mb-4 flex items-center gap-2">
				<FontAwesomeIcon icon={faFileLines} class="h-5 w-5 text-indigo-600" />
				<h2 class="text-lg font-bold text-gray-900">제안이유 및 주요내용 원문</h2>
			</div>
			<h3 class="mb-3 text-sm font-semibold text-gray-700">{detail.originalContent.title}</h3>
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<p class="text-sm leading-7 whitespace-pre-line text-gray-800">
					{detail.originalContent.proposalReason}
				</p>
			</div>
		</section>
	</main>
</div>
