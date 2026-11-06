<script lang="ts">
	import { onMount } from 'svelte';
	import Alert from '#lib/components/Alert.svelte';
	import ModalShell from '#lib/components/ModalShell.svelte';
	import NewThreadModal from '#lib/components/discussions/NewThreadModal.svelte';
	import { useNotifications, type NotificationType } from '#lib/utils/notifications.ts';
	const center = useNotifications();
	let ready = $state(false);
	let modal = $state(false);
	let form = $state(false);
	let feedback = $state('');
	let actions = $state(0);
	onMount(() => (ready = true));
	function add(type: NotificationType, message: string) {
		center.push({
			type,
			message,
			origin: document.activeElement as HTMLElement,
			action: { label: '다시 시도', handler: () => actions++ }
		});
	}
</script>

<svelte:head
	><meta name="robots" content="noindex, nofollow" /><title>Notification test fixture</title
	></svelte:head
>
<main id="main-content" class="p-8">
	<h1>Notification fixture</h1>
	<button disabled={!ready} onclick={() => add('success', '완료 알림')}>성공 알림</button>
	<button onclick={() => add('warning', '주의 알림')}>경고 알림</button>
	<button onclick={() => add('error', '오류 알림')}>오류 알림</button>
	<button
		onclick={() => {
			for (let i = 1; i <= 5; i++) add('info', `동시 알림 ${i}`);
		}}>동시 알림</button
	>
	<button onclick={() => (modal = true)}>모달 열기</button>
	<button onclick={() => (form = true)}>토론 폼 열기</button>
	<output data-testid="action-count">{actions}</output>
</main>
<ModalShell
	isOpen={modal}
	onClose={() => {
		modal = false;
		feedback = '';
	}}
	testId="notification-test-modal"
>
	{#snippet title()}알림 모달{/snippet}
	<button onclick={() => (feedback = '모달 오류 알림')}>모달 오류</button>
	{#if feedback}<Alert type="error" message={feedback} onDismiss={() => (feedback = '')} />{/if}
</ModalShell>
<NewThreadModal isOpen={form} onClose={() => (form = false)} />
