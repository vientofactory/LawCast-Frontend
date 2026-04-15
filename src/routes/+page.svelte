<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import WebhookRegistrationForm from '$lib/components/WebhookRegistrationForm.svelte';
	import RecentNotices from '$lib/components/RecentNotices.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;

	$: ({ recentNotices, stats } = data);
	const pageDescription =
		'국회 입법예고 변동사항을 디스코드로 빠르게 받아보세요. 최신 입법예고 목록과 시스템 상태를 한 번에 확인할 수 있습니다.';

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
		>LawCast - 국회 입법예고 알리미{recentNotices?.length > 0
			? ` | 최근 ${recentNotices.length}건`
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
		content={`LawCast - 국회 입법예고 알리미${recentNotices?.length > 0 ? ` | 최근 ${recentNotices.length}건` : ''}`}
	/>
	<meta property="og:description" content={pageDescription} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="twitter:title"
		content={`LawCast - 국회 입법예고 알리미${recentNotices?.length > 0 ? ` | 최근 ${recentNotices.length}건` : ''}`}
	/>
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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

		<blockquote
			class="rounded-lg border-l-4 border-blue-300 bg-linear-to-r from-blue-50/50 to-indigo-50/30 p-4 leading-relaxed font-medium text-slate-600 italic"
		>
			게임에 잠수함 패치는 있을 수 있지만, 법안에 잠수함 패치는 있을 수 없습니다.<br />
			모든 사람들이 입법예고의 투명한 감시 권리를 가질 수 있는 그 날까지 LawCast는 함께합니다.
		</blockquote>

		<div class="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
			<!-- Webhook Registration -->
			<WebhookRegistrationForm
				isInitialLoading={false}
				{stats}
				onError={handleWebhookError}
				onSuccess={handleWebhookSuccess}
				onClearMessage={clearMessage}
				onWebhookRegistered={handleWebhookRegistered}
			/>

			<!-- Recent Notices -->
			<RecentNotices notices={recentNotices} {stats} />
		</div>
	</main>
</div>

<style>
	/* 더 부드러운 호버 효과를 위한 커스텀 스타일 */
	:global(.group:hover .transition-colors) {
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
