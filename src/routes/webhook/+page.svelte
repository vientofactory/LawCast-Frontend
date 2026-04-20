<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import WebhookRegistrationForm from '$lib/components/WebhookRegistrationForm.svelte';
	import { invalidateAll } from '$app/navigation';

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
</script>

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
