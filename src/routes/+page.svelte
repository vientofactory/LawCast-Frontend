<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import WebhookRegistrationForm from '$lib/components/WebhookRegistrationForm.svelte';
	import RecentNotices from '$lib/components/RecentNotices.svelte';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';

	export let data: PageData;

	$: ({ recentNotices, stats } = data);
	$: archiveTotalCount = stats?.archive?.count ?? 0;
	$: aiSummaryEnabled =
		(stats as { aiSummaryEnabled?: boolean } | undefined)?.aiSummaryEnabled !== false;
	$: pageDescription = aiSummaryEnabled
		? '국회 입법예고 변동사항을 디스코드로 빠르게 받아보세요. 최신 입법예고 목록과 AI의 요약을 한 번에 확인할 수 있습니다.'
		: '국회 입법예고 변동사항을 디스코드로 빠르게 받아보세요. 최신 입법예고 목록과 원문 정보를 한 번에 확인할 수 있습니다.';

	// Local state for UI messages
	let error = '';
	let success = '';

	// Update error from data if present
	$: if (data.error) {
		error = data.error;
	}

	function clearMessage() {
		error = '';
		success = '';
	}

	function handleWebhookError(message: string) {
		error = message;
	}

	function handleWebhookSuccess(message: string) {
		success = message;
	}

	async function handleWebhookRegistered() {
		await invalidateAll(); // 통계 업데이트
	}
</script>

<svelte:head>
	<title
		>LawCast - 국회 입법예고 스냅샷 아카이브{archiveTotalCount > 0
			? ` | 전체 ${archiveTotalCount.toLocaleString('ko-KR')}건`
			: ''}</title
	>
	<meta name="description" content={pageDescription} />
	<meta
		name="keywords"
		content="LawCast, 입법예고, 국회 법률안, 법안 알림, 디스코드 웹훅, 법률안 모니터링"
	/>
	<meta name="robots" content="index, follow, max-image-preview:large" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="LawCast" />
	<meta
		property="og:title"
		content={`LawCast - 국회 입법예고 스냅샷 아카이브${archiveTotalCount > 0 ? ` | 전체 ${archiveTotalCount.toLocaleString('ko-KR')}건` : ''}`}
	/>
	<meta property="og:description" content={pageDescription} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="twitter:title"
		content={`LawCast - 국회 입법예고 스냅샷 아카이브${archiveTotalCount > 0 ? ` | 전체 ${archiveTotalCount.toLocaleString('ko-KR')}건` : ''}`}
	/>
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<div class="mt-5 flex flex-col gap-8">
			<section
				class="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm"
			>
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-base font-bold text-gray-900">법률안 빠른 검색</h2>
					<a
						href="/notices"
						class="text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800"
					>
						전체 입법예고로 이동
					</a>
				</div>
				<form method="GET" action="/notices" class="flex flex-col gap-2 sm:flex-row">
					<input
						type="text"
						name="search"
						placeholder="법률안명, 제안자, 소관위원회로 검색"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-xs outline-hidden transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
					/>
					<button
						type="submit"
						aria-label="검색"
						title="검색"
						class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-blue-700"
					>
						<FontAwesomeIcon icon={faMagnifyingGlass} class="h-4 w-4" />
					</button>
				</form>
			</section>

			<!-- Recent Notices -->
			<RecentNotices notices={recentNotices} {stats} />

			<!-- Messages -->
			{#if error}
				<Alert
					type="error"
					message={error}
					showRefresh={error.includes('초기 데이터')}
					onDismiss={clearMessage}
					onRefresh={() => location.reload()}
				/>
			{/if}

			{#if success}
				<Alert
					type="success"
					message={success}
					autoHide={true}
					autoHideDelay={4000}
					onDismiss={clearMessage}
				/>
			{/if}

			<!-- Webhook Registration -->
			<WebhookRegistrationForm
				isInitialLoading={false}
				{stats}
				onError={handleWebhookError}
				onSuccess={handleWebhookSuccess}
				onClearMessage={clearMessage}
				onWebhookRegistered={handleWebhookRegistered}
			/>
		</div>
	</main>
</div>

<style>
	/* 더 부드러운 호버 효과를 위한 커스텀 스타일 */
	:global(.group:hover .transition-colors) {
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
