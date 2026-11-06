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

	<main id="main-content" class="lc-main lc-main--form">
		<div class="lc-page-heading">
			<h1 class="lc-text-primary text-2xl font-bold">알림 설정</h1>
			<p class="lc-text-secondary mt-2 text-sm">
				새 입법예고와 변경 소식을 원하는 방식으로 받아보세요.
			</p>
		</div>
		<WebhookRegistrationForm
			isInitialLoading={false}
			onWebhookRegistered={handleWebhookRegistered}
		/>

		<WebPushConsentForm />
	</main>
</div>
