<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBellSlash } from '@fortawesome/free-solid-svg-icons';
	import ModalShell from './ModalShell.svelte';

	let {
		isOpen = false,
		isSubmitting = false,
		isSubscribed = false,
		onConfirm,
		onClose
	}: {
		isOpen?: boolean;
		isSubmitting?: boolean;
		isSubscribed?: boolean;
		onConfirm?: () => void;
		onClose?: () => void;
	} = $props();
</script>

<ModalShell
	{isOpen}
	labelledBy="full-web-push-unsubscribe-title"
	maxWidthClass="max-w-md"
	onClose={() => onClose?.()}
>
	{#snippet icon()}
		<FontAwesomeIcon icon={faBellSlash} class="h-4 w-4 text-red-500" />
	{/snippet}
	{#snippet title()}
		<span>모든 웹 푸시 구독을 해지할까요?</span>
	{/snippet}

	<div class="mt-5 space-y-5">
		<p class="lc-text-secondary text-sm leading-relaxed">
			입법예고 알림과 모든 토론 인용 알림이 이 브라우저에서 함께 해지됩니다.
		</p>

		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="lc-button-neutral cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold"
				onclick={() => onClose?.()}
			>
				취소
			</button>
			<button
				type="button"
				class="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={isSubmitting || !isSubscribed}
				onclick={() => onConfirm?.()}
			>
				<FontAwesomeIcon icon={faBellSlash} class="mr-1.5 h-3.5 w-3.5" />
				전체 해지
			</button>
		</div>
	</div>
</ModalShell>
