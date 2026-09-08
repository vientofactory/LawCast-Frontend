<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBellSlash } from '@fortawesome/free-solid-svg-icons';
	import ModalShell from './ModalShell.svelte';

	export let isOpen = false;
	export let isSubmitting = false;
	export let isSubscribed = false;
	export let onConfirm: (() => void) | undefined = undefined;
	export let onClose: (() => void) | undefined = undefined;
</script>

<ModalShell
	{isOpen}
	labelledBy="full-web-push-unsubscribe-title"
	maxWidthClass="max-w-md"
	onClose={() => onClose?.()}
>
	<FontAwesomeIcon slot="icon" icon={faBellSlash} class="h-4 w-4 text-red-500" />
	<span slot="title">모든 웹 푸시 구독을 해지할까요?</span>

	<div class="mt-5 space-y-5">
		<p class="lc-text-secondary text-sm leading-relaxed">
			입법예고 알림과 모든 토론 인용 알림이 이 브라우저에서 함께 해지됩니다.
		</p>

		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="lc-button-neutral cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold"
				on:click={() => onClose?.()}
			>
				취소
			</button>
			<button
				type="button"
				class="inline-flex cursor-pointer items-center rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={isSubmitting || !isSubscribed}
				on:click={() => onConfirm?.()}
			>
				<FontAwesomeIcon icon={faBellSlash} class="mr-1.5 h-3.5 w-3.5" />
				전체 해지
			</button>
		</div>
	</div>
</ModalShell>
