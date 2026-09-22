<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBell } from '@fortawesome/free-solid-svg-icons';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import WebPushConsentForm from '$lib/components/WebPushConsentForm.svelte';

	let {
		isOpen = false,
		threadId,
		onClose
	}: {
		isOpen?: boolean;
		threadId: number;
		onClose?: () => void;
	} = $props();

	let feedback: { type: 'success' | 'error'; message: string } | null = $state(null);

	function close() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(`lawcast-quote-push-dismissed:${threadId}`, '1');
		}
		feedback = null;
		isOpen = false;
		onClose?.();
	}

	function handleSuccess(message: string) {
		feedback = { type: 'success', message };
	}

	function handleError(message: string) {
		feedback = { type: 'error', message };
	}
</script>

<ModalShell
	{isOpen}
	labelledBy="discussion-push-consent-title"
	maxWidthClass="max-w-xl"
	testId="discussion-push-consent-modal"
	onClose={close}
>
	{#snippet icon()}
		<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-blue-500" />
	{/snippet}
	{#snippet title()}
		<span>인용 알림을 받아보시겠어요?</span>
	{/snippet}
	{#snippet subtitle()}
		<span>작성하신 의견이 인용되면 브라우저 알림을 받을 수 있습니다.</span>
	{/snippet}

	{#if feedback}
		<div
			class={`mb-4 rounded-lg border p-3 text-sm ${
				feedback.type === 'success'
					? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
					: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
			}`}
			role={feedback.type === 'error' ? 'alert' : 'status'}
		>
			{feedback.message}
		</div>
	{/if}

	<WebPushConsentForm
		{threadId}
		showFullUnsubscribeControl={false}
		showInlineFeedback={false}
		compact
		onSuccess={handleSuccess}
		onError={handleError}
	/>

	<button
		type="button"
		class="lc-button-secondary mt-3 w-full cursor-pointer rounded-xl border px-4 py-2 text-sm"
		onclick={close}
	>
		나중에
	</button>
</ModalShell>
