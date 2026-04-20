<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import WebhookRegistrationForm from '$lib/components/WebhookRegistrationForm.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	let error = '';
	let success = '';

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
		await invalidateAll();
	}

	onMount(async () => {
		const { warmupHashGuardWorker } = await import('$lib/hashguard-worker');
		try {
			await warmupHashGuardWorker();
		} catch {
			/* empty */
		}
	});
</script>

<svelte:head>
	<title>LawCast - 웹훅 등록 | 국회 입법예고 스냅샷 아카이브</title>
	<meta
		name="description"
		content="LawCast 웹훅 등록 페이지. 국회 입법예고 변동사항을 디스코드 등으로 실시간 받아보려면 웹훅을 등록하세요."
	/>
	<meta
		name="keywords"
		content="LawCast, 입법예고, 웹훅, 디스코드, 알림, 국회 법률안, 법안 모니터링, 입법예고 알림"
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="LawCast - 웹훅 등록 | 국회 입법예고 스냅샷 아카이브" />
	<meta
		property="og:description"
		content="LawCast 웹훅 등록 페이지. 국회 입법예고 변동사항을 디스코드 등으로 실시간 받아보려면 웹훅을 등록하세요."
	/>
	<meta name="twitter:title" content="LawCast - 웹훅 등록 | 국회 입법예고 스냅샷 아카이브" />
	<meta
		name="twitter:description"
		content="LawCast 웹훅 등록 페이지. 국회 입법예고 변동사항을 디스코드 등으로 실시간 받아보려면 웹훅을 등록하세요."
	/>
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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

		<WebhookRegistrationForm
			isInitialLoading={false}
			onError={handleWebhookError}
			onSuccess={handleWebhookSuccess}
			onClearMessage={clearMessage}
			onWebhookRegistered={handleWebhookRegistered}
		/>
	</main>
</div>
