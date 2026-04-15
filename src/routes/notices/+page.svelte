<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import { openExternalLink, downloadFile, isDownloadable } from '$lib/utils/helpers';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBell,
		faCalendar,
		faExternalLink,
		faFileDownload,
		faFileText,
		faSpinner,
		faTriangleExclamation,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;

	$: notices = data.notices || [];
	const pageDescription =
		'국회 입법예고 전체 목록과 AI 요약을 확인하고, 각 법률안의 제안이유 및 주요내용 원문으로 이동할 수 있습니다.';

	let error = '';
	$: if (data) {
		error = data.error || '';
	}

	let isLoading = false;
	let currentPage = 1;
	const itemsPerPage = 10;

	async function loadNotices() {
		try {
			isLoading = true;
			await invalidateAll();
		} catch (err) {
			console.error('Failed to load notices:', err);
			error = '데이터를 새로고침하는데 실패했습니다.';
		} finally {
			isLoading = false;
		}
	}

	$: paginatedNotices = notices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	$: totalPages = Math.ceil(notices.length / itemsPerPage);

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function getPaginationInfo() {
		const start = (currentPage - 1) * itemsPerPage + 1;
		const end = Math.min(currentPage * itemsPerPage, notices.length);
		return `${start}-${end} / ${notices.length}개`;
	}
</script>

<svelte:head>
	<title>전체 입법예고{notices.length > 0 ? ` (${notices.length}건)` : ''} - LawCast</title>
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
		content={`전체 입법예고${notices.length > 0 ? ` (${notices.length}건)` : ''} - LawCast`}
	/>
	<meta property="og:description" content={pageDescription} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="twitter:title"
		content={`전체 입법예고${notices.length > 0 ? ` (${notices.length}건)` : ''} - LawCast`}
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

		<div class="mb-8 rounded-2xl border border-white/50 bg-white/70 p-8 shadow-lg backdrop-blur-sm">
			<div class="mb-4 flex items-center">
				<div class="mr-4 rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 p-3">
					<FontAwesomeIcon icon={faBell} class="h-8 w-8 text-white" />
				</div>
				<div>
					<h1 class="text-4xl font-bold tracking-tight text-gray-800">전체 입법예고</h1>
					<p class="mt-2 text-lg text-gray-600">
						최근 수집된 입법예고 목록입니다.
						<span
							class="ml-2 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700"
						>
							{notices.length}개
						</span>
					</p>
				</div>
			</div>
		</div>

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

		{#if isLoading}
			<div class="flex items-center justify-center py-16">
				<div class="text-center">
					<FontAwesomeIcon
						icon={faSpinner}
						class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600"
					/>
					<p class="text-gray-600">입법예고 데이터를 불러오는 중...</p>
				</div>
			</div>
		{:else if error}
			<Alert
				type="error"
				message={error}
				customAction={{ label: '다시 시도', handler: loadNotices }}
				dismissible={false}
			/>
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
			<div class="space-y-4">
				{#each paginatedNotices as notice (notice.num)}
					<div class="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
						<div class="flex items-start justify-between">
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
											의견 {notice.numComments.toLocaleString()}개
										</span>
									{/if}
								</div>

								<h3 class="mb-3 text-lg leading-tight font-semibold text-gray-900">
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

								{#if notice.aiSummary}
									<AIBriefingCard summary={notice.aiSummary} />
								{/if}
							</div>

							<div class="ml-4 flex shrink-0 items-center gap-2">
								<a
									href={`/notices/${notice.num}`}
									class="inline-flex items-center rounded-md bg-cyan-50 px-2.5 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 hover:text-cyan-800"
									title="제안이유 및 주요내용 원문 조회"
								>
									원문 조회
								</a>

								{#if notice.attachments && (isDownloadable(notice.attachments.pdfFile) || isDownloadable(notice.attachments.hwpFile))}
									<div class="flex gap-1">
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
									</div>
									<div class="h-6 w-px bg-gray-200"></div>
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
					<button
						on:click={() => goToPage(currentPage - 1)}
						disabled={currentPage === 1}
						class="rounded-xl border-2 border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
					>
						이전
					</button>

					{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
						const start = Math.max(1, currentPage - 2);
						const end = Math.min(totalPages, start + 4);
						return start + i <= end ? start + i : null;
					}).filter((page): page is number => page !== null) as page (page)}
						<button
							on:click={() => goToPage(page)}
							class={`rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-all duration-200 hover:shadow-md ${
								currentPage === page
									? 'scale-105 bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/50'
									: 'border-2 border-gray-200 bg-white/80 text-gray-600 backdrop-blur-sm hover:border-blue-200 hover:bg-white hover:text-blue-600'
							}`}
						>
							{page}
						</button>
					{/each}
					<button
						on:click={() => goToPage(currentPage + 1)}
						disabled={currentPage === totalPages}
						class="rounded-xl border-2 border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
					>
						다음
					</button>
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
