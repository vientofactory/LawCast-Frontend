<script lang="ts">
	import type { Snippet } from 'svelte';
	import { modalFocus } from '$lib/utils/modal-focus';
	import { modalBackdrop, modalPanel } from '$lib/utils/modal-motion';
	import NotificationViewport from './NotificationViewport.svelte';
	const notificationScope = $props.id();
	import ModalCloseButton from './ModalCloseButton.svelte';

	let {
		isOpen = false,
		labelledBy = 'modal-title',
		maxWidthClass = 'max-w-lg',
		testId,
		returnFocus,
		stickyHeader = false,
		closeDisabled = false,
		onClose,
		icon,
		title,
		subtitle,
		children
	}: {
		isOpen?: boolean;
		labelledBy?: string;
		maxWidthClass?: string;
		testId?: string;
		returnFocus?: HTMLElement;
		stickyHeader?: boolean;
		closeDisabled?: boolean;
		onClose?: () => void;
		icon?: Snippet;
		title?: Snippet;
		subtitle?: Snippet;
		children?: Snippet;
	} = $props();

	function handleClose() {
		if (closeDisabled) return;
		onClose?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Keep active modal actions above consent and installation prompts. -->
	<div
		class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
		role="presentation"
		in:modalBackdrop
		out:modalBackdrop={{ exiting: true }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={handleClose}></div>

		<div
			class={`relative w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-6 shadow-xl`}
			use:modalFocus={{ returnFocus }}
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledBy}
			data-testid={testId}
			data-notification-scope={notificationScope}
			in:modalPanel
			out:modalPanel={{ exiting: true }}
		>
			<div
				class={`mb-4 flex items-center justify-between border-b border-[var(--lc-border-soft)] pb-3 ${stickyHeader ? 'sticky top-0 z-10 bg-[var(--lc-surface-elevated)]' : ''}`}
			>
				<div class="flex min-w-0 items-center gap-2">
					<div class="shrink-0 rounded-lg p-2">
						{@render icon?.()}
					</div>
					<div class="min-w-0">
						<h2 id={labelledBy} class="lc-text-primary text-base font-bold">
							{@render title?.()}
						</h2>
						{#if subtitle}
							<p class="lc-text-muted text-xs">{@render subtitle()}</p>
						{/if}
					</div>
				</div>
				<ModalCloseButton onclick={handleClose} disabled={closeDisabled} />
			</div>

			{@render children?.()}
			<NotificationViewport scope={notificationScope} />
		</div>
	</div>
{/if}
