<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, ExternalLink, Loader2, ArrowLeft, Calendar, Users } from 'lucide-svelte';
	import axios from 'axios';
	import Header from '$lib/components/Header.svelte';
	import { PUBLIC_VITE_API_BASE_URL } from '$env/static/public';

	const API_BASE = PUBLIC_VITE_API_BASE_URL || 'http://localhost:3001/api';

	interface Notice {
		num: number;
		subject: string;
		proposerCategory: string;
		committee: string;
		numComments: number;
		link: string;
	}

	let notices: Notice[] = [];
	let isLoading = true;
	let error = '';
	let currentPage = 1;
	const itemsPerPage = 20;

	onMount(async () => {
		await loadNotices();
	});

	async function loadNotices() {
		try {
			isLoading = true;
			const response = await axios.get(`${API_BASE}/notices/recent?limit=100`);
			notices = response.data.data || [];
		} catch (err) {
			console.error('Failed to load notices:', err);
			error = '입법예고 데이터를 불러오는데 실패했습니다.';
		} finally {
			isLoading = false;
		}
	}

	function openNoticeLink(link: string) {
		window.open(link, '_blank', 'noopener,noreferrer');
	}

	$: paginatedNotices = notices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	$: totalPages = Math.ceil(notices.length / itemsPerPage);

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}
</script>

<svelte:head>
	<title>전체 입법예고 - LawCast</title>
	<meta name="description" content="국회 입법예고 전체 목록을 확인하세요." />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Breadcrumb -->
		<nav class="mb-6 flex items-center space-x-2 text-sm text-gray-600">
			<a href="../" class="flex items-center hover:text-gray-900">
				<ArrowLeft class="mr-1 h-4 w-4" />
				메인으로
			</a>
			<span>/</span>
			<span class="text-gray-900">전체 입법예고</span>
		</nav>

		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-3xl font-bold text-gray-900">전체 입법예고</h1>
			<p class="mt-2 text-gray-600">
				최근 수집된 입법예고 목록입니다. ({notices.length}개)
			</p>
		</div>

		<!-- Loading State -->
		{#if isLoading}
			<div class="flex items-center justify-center py-16">
				<div class="text-center">
					<Loader2 class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
					<p class="text-gray-600">입법예고 데이터를 불러오는 중...</p>
				</div>
			</div>
		{:else if error}
			<div class="rounded-md border border-red-200 bg-red-50 p-6 text-center">
				<p class="text-red-800">{error}</p>
				<button
					on:click={loadNotices}
					class="mt-2 rounded-md bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200"
				>
					다시 시도
				</button>
			</div>
		{:else if notices.length === 0}
			<div class="rounded-lg bg-white p-12 text-center shadow">
				<Bell class="mx-auto mb-4 h-16 w-16 text-gray-300" />
				<h3 class="text-lg font-medium text-gray-900">입법예고가 없습니다</h3>
				<p class="mt-2 text-gray-600">
					아직 수집된 입법예고가 없습니다. 서버가 시작되면 자동으로 데이터를 수집합니다.
				</p>
			</div>
		{:else}
			<!-- Notices List -->
			<div class="space-y-4">
				{#each paginatedNotices as notice (notice.num)}
					<div class="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
						<div class="flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<div class="mb-3 flex items-center space-x-2">
									<span
										class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
									>
										의안번호 {notice.num}
									</span>
									{#if notice.numComments > 0}
										<span
											class="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
										>
											<Users class="mr-1 h-3 w-3" />
											의견 {notice.numComments}개
										</span>
									{/if}
								</div>

								<h3 class="mb-3 text-lg leading-tight font-semibold text-gray-900">
									{notice.subject}
								</h3>

								<div class="flex flex-wrap gap-4 text-sm text-gray-600">
									<div class="flex items-center">
										<Calendar class="mr-1 h-4 w-4" />
										제안자 구분: {notice.proposerCategory}
									</div>
									<div class="flex items-center">
										<Bell class="mr-1 h-4 w-4" />
										소관위원회: {notice.committee}
									</div>
								</div>
							</div>

							<button
								on:click={() => openNoticeLink(notice.link)}
								class="ml-4 shrink-0 rounded-md bg-blue-50 p-3 text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
								title="자세히 보기"
							>
								<ExternalLink class="h-5 w-5" />
							</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="mt-8 flex items-center justify-center space-x-2">
					<button
						on:click={() => goToPage(currentPage - 1)}
						disabled={currentPage === 1}
						class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
							class={`rounded-md px-3 py-2 text-sm font-medium ${
								currentPage === page
									? 'bg-blue-600 text-white'
									: 'border border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
							}`}
						>
							{page}
						</button>
					{/each}
					<button
						on:click={() => goToPage(currentPage + 1)}
						disabled={currentPage === totalPages}
						class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						다음
					</button>
				</div>

				<div class="mt-4 text-center text-sm text-gray-600">
					{(currentPage - 1) * itemsPerPage + 1}-{Math.min(
						currentPage * itemsPerPage,
						notices.length
					)} / {notices.length}개
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
