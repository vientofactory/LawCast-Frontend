<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import { openExternalLink, downloadFile, isDownloadable } from '$lib/utils/helpers';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faAnglesLeft,
		faAnglesRight,
		faBell,
		faCalendar,
		faChevronLeft,
		faChevronRight,
		faExternalLink,
		faFileDownload,
		faFileText,
		faMagnifyingGlass,
		faTriangleExclamation,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import type { ArchiveNoticeListResponse } from '$lib/types/api';

	export let data: {
		archive: ArchiveNoticeListResponse;
		error?: string;
	};

	$: archive = data.archive;
	$: notices = archive?.items || [];
	$: currentPage = archive?.page || 1;
	$: totalPages = archive?.totalPages || 1;
	$: totalItems = archive?.total || 0;
	$: limit = archive?.limit || 10;
	$: searchQuery = archive?.search || '';
	$: archiveCount = archive?.stats?.archiveCount || 0;

	const pageDescription =
		'입법예고 아카이브에서 키워드 검색과 페이지네이션으로 법률안을 조회하고, 원문과 AI 요약을 확인할 수 있습니다.';

	let error = '';
	$: if (data) {
		error = data.error || '';
	}

	function buildPageLink(page: number) {
		const params = [`page=${encodeURIComponent(String(page))}`];
		params.push(`limit=${encodeURIComponent(String(limit))}`);

		const trimmedSearch = searchQuery.trim();
		if (trimmedSearch) {
			params.push(`search=${encodeURIComponent(trimmedSearch)}`);
		}

		return `/notices?${params.join('&')}`;
	}

	function getPaginationInfo() {
		if (totalItems === 0) {
			return '0개';
		}

		const start = (currentPage - 1) * limit + 1;
		const end = Math.min(currentPage * limit, totalItems);
		return `${start}-${end} / ${totalItems}개`;
	}

	function shouldShowAIBriefing(notice: (typeof notices)[number]) {
		return notice.aiSummaryStatus === 'ready' || notice.aiSummaryStatus === 'unavailable';
	}

	function getPaginationItems(): Array<number | 'left-ellipsis' | 'right-ellipsis'> {
		if (totalPages <= 7) {
			return Array.from({ length: totalPages }, (_, idx) => idx + 1);
		}

		const items: Array<number | 'left-ellipsis' | 'right-ellipsis'> = [1];
		let start = Math.max(2, currentPage - 1);
		let end = Math.min(totalPages - 1, currentPage + 1);

		if (currentPage <= 3) {
			start = 2;
			end = 4;
		} else if (currentPage >= totalPages - 2) {
			start = totalPages - 3;
			end = totalPages - 1;
		}

		if (start > 2) {
			items.push('left-ellipsis');
		}

		for (let page = start; page <= end; page++) {
			items.push(page);
		}

		if (end < totalPages - 1) {
			items.push('right-ellipsis');
		}

		items.push(totalPages);
		return items;
	}
</script>

<svelte:head>
	<title
		>전체 입법예고{notices.length > 0 ? ` (${notices.length.toLocaleString('ko-KR')}건)` : ''} - LawCast</title
	>
	<meta name="description" content={pageDescription} />
	<meta
		name="keywords"
		content="전체 입법예고, 국회 법률안 목록, 법안 원문 조회, 제안이유 및 주요내용, AI 요약"
	/>
	<meta name="robots" content="index, follow, max-image-preview:large" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="LawCast" />
	<meta
		property="og:title"
		content={`전체 입법예고${notices.length > 0 ? ` (${notices.length.toLocaleString('ko-KR')}건)` : ''} - LawCast`}
	/>
	<meta property="og:description" content={pageDescription} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="twitter:title"
		content={`전체 입법예고${notices.length > 0 ? ` (${notices.length.toLocaleString('ko-KR')}건)` : ''} - LawCast`}
	/>
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<nav class="mb-8 flex items-center space-x-3 text-sm">
			<a
				href="../"
				class="flex items-center rounded-lg border border-gray-200/50 bg-white/60 px-3 py-2 text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/80 hover:text-gray-800"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				메인으로
			</a>
			<span class="text-gray-400">/</span>
			<span class="font-semibold text-gray-700">전체 입법예고</span>
		</nav>

		<div
			class="mb-6 rounded-xl border border-amber-200/80 bg-linear-to-r from-amber-50 to-orange-50 p-4 shadow-sm"
		>
			<div class="flex items-start gap-3">
				<div class="mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700">
					<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
				</div>
				<div>
					<p class="text-sm font-semibold text-amber-900">안내</p>
					<p class="mt-1 text-sm leading-relaxed text-amber-800/90">
						AI 요약은 참고용으로 제공되며 해석상 오류가 있을 수 있습니다. 중요 판단 전 반드시 각
						법률안의 원문(제안이유 및 주요내용)을 함께 확인해주세요.
					</p>
				</div>
			</div>
		</div>

		<div
			class="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
		>
			<p class="text-sm font-medium text-slate-600">입법예고 아카이브 건수</p>
			<p class="text-lg font-bold text-slate-900">{archiveCount.toLocaleString('ko-KR')}건</p>
		</div>

		{#if error}
			<Alert type="error" message={error} dismissible={false} />
		{:else if notices.length === 0}
			<div
				class="rounded-2xl border border-gray-200/50 bg-linear-to-br from-gray-50 to-blue-50/30 p-16 text-center shadow-xl backdrop-blur-sm"
			>
				<div class="mb-6 inline-block rounded-full bg-linear-to-r from-gray-200 to-blue-200 p-6">
					<FontAwesomeIcon icon={faBell} class="h-16 w-16 text-gray-400" />
				</div>
				<h3 class="mb-3 text-2xl font-bold text-gray-800">입법예고가 없습니다</h3>
			</div>
		{:else}
			<form method="GET" action="/notices" class="mb-5">
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div class="relative flex-1">
						<FontAwesomeIcon
							icon={faMagnifyingGlass}
							class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
						/>
						<input
							type="text"
							name="search"
							value={searchQuery}
							placeholder="법률안명, 소관위원회, 원문 키워드 검색"
							class="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-10 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
						/>
					</div>
					<input type="hidden" name="page" value="1" />
					<input type="hidden" name="limit" value={String(limit)} />
					<button
						type="submit"
						class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
					>
						검색
					</button>
				</div>
			</form>

			<div class="space-y-4">
				{#each notices as notice (notice.num)}
					<div class="rounded-lg bg-white p-4 shadow transition-shadow hover:shadow-md sm:p-6">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0 flex-1">
								<div class="mb-3 flex flex-wrap items-center gap-2">
									<span
										class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
									>
										의안번호 {notice.num}
									</span>
									{#if notice.numComments > 0}
										<span
											class="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
										>
											<FontAwesomeIcon icon={faUser} class="mr-1 h-3 w-3" />
											의견 {notice.numComments.toLocaleString('ko-KR')}개
										</span>
									{/if}
								</div>

								<h3 class="mb-3 text-lg leading-tight font-semibold wrap-break-word text-gray-900">
									{notice.subject}
								</h3>

								<div class="flex flex-wrap gap-4 text-sm text-gray-600">
									<div class="flex items-center">
										<FontAwesomeIcon icon={faCalendar} class="mr-1 h-4 w-4" />
										제안자 구분: {notice.proposerCategory}
									</div>
									<div class="flex items-center">
										<FontAwesomeIcon icon={faBell} class="mr-1 h-4 w-4" />
										소관위원회: {notice.committee}
									</div>
								</div>

								{#if shouldShowAIBriefing(notice)}
									<AIBriefingCard
										summary={notice.aiSummary ?? null}
										status={notice.aiSummaryStatus ?? 'unavailable'}
									/>
								{/if}
							</div>

							<div
								class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end lg:ml-4 lg:w-auto lg:shrink-0"
							>
								<a
									href={`/notices/${notice.num}`}
									class="inline-flex items-center rounded-md bg-cyan-50 px-2.5 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 hover:text-cyan-800"
									title="제안이유 및 주요내용 원문 조회"
								>
									원문 조회
								</a>

								{#if notice.attachments && (isDownloadable(notice.attachments.pdfFile) || isDownloadable(notice.attachments.hwpFile))}
									<div class="flex items-center gap-1">
										{#if isDownloadable(notice.attachments.pdfFile)}
											<button
												on:click={() =>
													downloadFile(notice.attachments.pdfFile, `${notice.num}.pdf`)}
												class="cursor-pointer rounded-md bg-red-50 p-2.5 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
												title="PDF 다운로드"
											>
												<FontAwesomeIcon icon={faFileText} class="h-5 w-5" />
											</button>
										{/if}
										{#if isDownloadable(notice.attachments.hwpFile)}
											<button
												on:click={() =>
													downloadFile(notice.attachments.hwpFile, `${notice.num}.hwp`)}
												class="cursor-pointer rounded-md bg-blue-50 p-2.5 text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
												title="HWP 다운로드"
											>
												<FontAwesomeIcon icon={faFileDownload} class="h-5 w-5" />
											</button>
										{/if}
										<div class="hidden h-6 w-px bg-gray-200 sm:block"></div>
									</div>
								{/if}
								<button
									on:click={() => openExternalLink(notice.link)}
									class="cursor-pointer rounded-md bg-gray-50 p-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700"
									title="자세히 보기"
								>
									<FontAwesomeIcon icon={faExternalLink} class="h-5 w-5" />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if totalPages > 1}
				<div class="mt-12 flex items-center justify-center space-x-3">
					<a
						href={currentPage > 1 ? buildPageLink(1) : '#'}
						aria-disabled={currentPage === 1}
						aria-label="첫 페이지로 이동"
						title="첫 페이지"
						class="rounded-xl border-2 border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md aria-disabled:pointer-events-none aria-disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faAnglesLeft} class="h-4 w-4" />
					</a>
					<a
						href={currentPage > 1 ? buildPageLink(currentPage - 1) : '#'}
						aria-disabled={currentPage === 1}
						aria-label="이전 페이지로 이동"
						title="이전 페이지"
						class="rounded-xl border-2 border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md aria-disabled:pointer-events-none aria-disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
					</a>

					{#each getPaginationItems() as item, idx (`${item}-${idx}`)}
						{#if typeof item === 'number'}
							<a
								href={buildPageLink(item)}
								class={`rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-all duration-200 hover:shadow-md ${
									currentPage === item
										? 'scale-105 bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/50'
										: 'border-2 border-gray-200 bg-white/80 text-gray-600 backdrop-blur-sm hover:border-blue-200 hover:bg-white hover:text-blue-600'
								}`}
							>
								{item}
							</a>
						{:else}
							<span class="px-2 text-sm font-semibold text-gray-400">...</span>
						{/if}
					{/each}
					<a
						href={currentPage < totalPages ? buildPageLink(currentPage + 1) : '#'}
						aria-disabled={currentPage === totalPages}
						aria-label="다음 페이지로 이동"
						title="다음 페이지"
						class="rounded-xl border-2 border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md aria-disabled:pointer-events-none aria-disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
					</a>
					<a
						href={currentPage < totalPages ? buildPageLink(totalPages) : '#'}
						aria-disabled={currentPage === totalPages}
						aria-label="마지막 페이지로 이동"
						title="마지막 페이지"
						class="rounded-xl border-2 border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md aria-disabled:pointer-events-none aria-disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faAnglesRight} class="h-4 w-4" />
					</a>
				</div>

				<div class="mt-6 text-center">
					<span
						class="inline-flex items-center rounded-full bg-linear-to-r from-gray-100 to-blue-100 px-4 py-2 text-sm font-semibold text-gray-700"
					>
						{getPaginationInfo()}
					</span>
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	a {
		text-decoration: none;
	}

	a:hover {
		text-decoration: none;
	}
</style>
