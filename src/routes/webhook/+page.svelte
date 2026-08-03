<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import WebhookRegistrationForm from '$lib/components/WebhookRegistrationForm.svelte';
	import WebPushConsentForm from '$lib/components/WebPushConsentForm.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { warmupHashGuardWorker } from '$lib/hashguard-worker';
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
		try {
			await warmupHashGuardWorker();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<svelte:head>
	<title>LawCast - 알림 설정 | 국회 입법예고 스냅샷 아카이브</title>
	<meta
		name="description"
		content="LawCast 알림 설정 페이지. 디스코드 웹훅과 브라우저 웹 푸시로 국회 입법예고 변동사항을 실시간으로 받아보세요."
	/>
	<meta
		name="keywords"
		content="LawCast, 입법예고, 디스코드 웹훅, 웹 푸시, 브라우저 알림, 국회 법률안, 법안 모니터링, 입법예고 알림"
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="LawCast - 알림 설정 | 국회 입법예고 스냅샷 아카이브" />
	<meta
		property="og:description"
		content="LawCast 알림 설정 페이지. 디스코드 웹훅과 브라우저 웹 푸시로 국회 입법예고 변동사항을 실시간으로 받아보세요."
	/>
	<meta name="twitter:title" content="LawCast - 알림 설정 | 국회 입법예고 스냅샷 아카이브" />
	<meta
		name="twitter:description"
		content="LawCast 알림 설정 페이지. 디스코드 웹훅과 브라우저 웹 푸시로 국회 입법예고 변동사항을 실시간으로 받아보세요."
	/>
</svelte:head>

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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

		<WebPushConsentForm
			onError={handleWebhookError}
			onSuccess={handleWebhookSuccess}
			onClearMessage={clearMessage}
		/>
	</main>
</div>
