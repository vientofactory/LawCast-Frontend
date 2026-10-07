<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import WebhookRegistrationForm from '$lib/components/WebhookRegistrationForm.svelte';
	import WebPushConsentForm from '$lib/components/WebPushConsentForm.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { warmupHashGuardWorker } from '$lib/hashguard-worker';
	import { page } from '$app/state';
	import SeoHead from '$lib/components/SeoHead.svelte';

	let pageUrl = $derived(page.url.origin + page.url.pathname);

	async function handleWebhookRegistered() {
		await invalidateAll();
	}

	onMount(async () => {
		try {
			await warmupHashGuardWorker();
		} catch (e) {
			console.error('Failed to warm up hash guard worker:', e);
		}
	});
</script>

<SeoHead
	title="알림 설정"
	description="LawCast 알림 설정 페이지. 디스코드 웹훅과 브라우저 웹 푸시로 국회 입법예고 변동사항을 실시간으로 받아보세요."
	url={pageUrl}
	keywords="LawCast, 입법예고, 디스코드 웹훅, 웹 푸시, 브라우저 알림, 국회 법률안, 법안 모니터링, 입법예고 알림"
/>

<div class="lc-page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<WebhookRegistrationForm
			isInitialLoading={false}
			onWebhookRegistered={handleWebhookRegistered}
		/>

		<WebPushConsentForm />
	</main>
</div>
