<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faXmark } from '@fortawesome/free-solid-svg-icons';

	export let isOpen = false;
	export let labelledBy = 'modal-title';
	export let maxWidthClass = 'max-w-lg';
	export let testId: string | undefined = undefined;
	export let closeDisabled = false;
	export let onClose: (() => void) | undefined = undefined;

	function handleClose() {
		if (closeDisabled) return;
		isOpen = false;
		onClose?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			handleClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4"
		role="presentation"
		transition:fade={{ duration: 180 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute inset-0" on:click={handleClose}></div>

		<div
			class={`relative w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-6 shadow-xl`}
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledBy}
			data-testid={testId}
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div
				class="mb-4 flex items-center justify-between border-b border-[var(--lc-border-soft)] pb-3"
			>
				<div class="flex min-w-0 items-center gap-2">
					<div class="shrink-0 rounded-lg p-2">
						<slot name="icon" />
					</div>
					<div class="min-w-0">
						<h2 id={labelledBy} class="lc-text-primary text-base font-bold">
							<slot name="title" />
						</h2>
						{#if $$slots.subtitle}
							<p class="lc-text-muted text-xs"><slot name="subtitle" /></p>
						{/if}
					</div>
				</div>
				<button
					type="button"
					on:click={handleClose}
					disabled={closeDisabled}
					class="lc-text-muted hover:lc-text-primary cursor-pointer p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="닫기"
				>
					<FontAwesomeIcon icon={faXmark} class="h-4 w-4" />
				</button>
			</div>

			<slot />
		</div>
	</div>
{/if}
