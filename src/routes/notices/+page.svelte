<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, ExternalLink, Loader2, ArrowLeft, Calendar, Users } from 'lucide-svelte';
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { apiClient } from '$lib/api/client';
	import type { Notice } from '$lib/types/api';
	import { openExternalLink } from '$lib/utils/helpers';

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
			notices = await apiClient.getRecentNotices();
		} catch (err) {
			console.error('Failed to load notices:', err);
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = '입법예고 데이터를 불러오는데 실패했습니다.';
			}
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
</script>

<svelte:head>
	<title>전체 입법예고 - LawCast</title>
	<meta name="description" content="국회 입법예고 전체 목록을 확인하세요." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Breadcrumb -->
		<nav class="mb-8 flex items-center space-x-3 text-sm">
			<a
				href="../"
				class="flex items-center rounded-lg border border-gray-200/50 bg-white/60 px-3 py-2 text-gray-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/80 hover:text-gray-800"
			>
				<ArrowLeft class="mr-2 h-4 w-4" />
				메인으로
			</a>
			<span class="text-gray-400">/</span>
			<span class="font-semibold text-gray-700">전체 입법예고</span>
		</nav>

		<!-- Header -->
		<div class="mb-8 rounded-2xl border border-white/50 bg-white/70 p-8 shadow-lg backdrop-blur-sm">
			<div class="mb-4 flex items-center">
				<div class="mr-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 p-3">
					<Bell class="h-8 w-8 text-white" />
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

		<!-- Loading State -->
		{#if isLoading}
			<div class="flex items-center justify-center py-16">
				<div class="text-center">
					<Loader2 class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
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
				class="rounded-2xl border border-gray-200/50 bg-gradient-to-br from-gray-50 to-blue-50/30 p-16 text-center shadow-xl backdrop-blur-sm"
			>
				<div class="mb-6 inline-block rounded-full bg-gradient-to-r from-gray-200 to-blue-200 p-6">
					<Bell class="h-16 w-16 text-gray-400" />
				</div>
				<h3 class="mb-3 text-2xl font-bold text-gray-800">입법예고가 없습니다</h3>
				<p class="mx-auto max-w-md text-lg leading-relaxed text-gray-600">
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
								on:click={() => openExternalLink(notice.link)}
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
									? 'scale-105 bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/50'
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
						class="inline-flex items-center rounded-full bg-gradient-to-r from-gray-100 to-blue-100 px-4 py-2 text-sm font-semibold text-gray-700"
					>
						{(currentPage - 1) * itemsPerPage + 1}-{Math.min(
							currentPage * itemsPerPage,
							notices.length
						)} / {notices.length}개
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
