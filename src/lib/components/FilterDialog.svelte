<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import ModalCloseButton from './ModalCloseButton.svelte';
	import { animateNativeModal } from '#lib/utils/modal-motion.ts';
	import { trapModalTab } from '#lib/utils/modal-focus.ts';

	let {
		isOpen = $bindable(false),
		title,
		testId,
		children
	}: {
		isOpen?: boolean;
		title: string;
		testId: string;
		children: Snippet<[() => void]>;
	} = $props();
	let dialog = $state<HTMLDialogElement>();
	let displayed = $state(false);
	let phase = $state<'opening' | 'closing' | undefined>();
	let animation: Animation | null = null;
	let generation = 0;

	let draft: { element: HTMLInputElement | HTMLSelectElement; value: string; checked?: boolean }[] =
		[];
	function cancel() {
		for (const { element, value, checked } of draft) {
			element.value = value;
			if (element instanceof HTMLInputElement && checked !== undefined) element.checked = checked;
		}
		isOpen = false;
	}

	function trapTab(event: KeyboardEvent) {
		if (dialog) trapModalTab(event, dialog);
	}

	$effect(() => {
		if (!dialog) return;
		const node = dialog;
		const opening = isOpen;
		const token = ++generation;
		const current = node.open
			? { opacity: getComputedStyle(node).opacity, transform: getComputedStyle(node).transform }
			: undefined;
		animation?.cancel();
		animation = null;
		if (!opening && !node.open) {
			phase = undefined;
			displayed = false;
			return;
		}
		if (opening && !node.open) {
			draft = Array.from(
				node.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
			).map((element) => ({
				element,
				value: element.value,
				checked: element instanceof HTMLInputElement ? element.checked : undefined
			}));
			node.showModal();
			displayed = true;
			node.querySelector<HTMLElement>('h2')?.focus();
		}
		phase = opening ? 'opening' : 'closing';
		animation = animateNativeModal(node, opening, current);
		const finish = () => {
			if (generation !== token) return;
			if (!opening) {
				node.close();
				displayed = false;
			}
			animation?.cancel();
			animation = null;
			phase = undefined;
		};
		if (animation) void animation.finished.then(finish, () => {});
		else finish();
	});

	onDestroy(() => {
		generation++;
		animation?.cancel();
		if (dialog?.open) dialog.close();
	});

	$effect(() => {
		if (!displayed) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<dialog
	bind:this={dialog}
	class="lc-filter-dialog"
	data-modal-phase={phase}
	aria-labelledby={`${testId}-title`}
	data-testid={testId}
	onkeydown={trapTab}
	oncancel={(event) => {
		event.preventDefault();
		cancel();
	}}
	onclose={() => {
		if (!dialog?.open) {
			isOpen = false;
			displayed = false;
		}
	}}
>
	<div class="lc-dialog-heading">
		<h2 id={`${testId}-title`} tabindex="-1" class="lc-text-primary text-lg font-bold">{title}</h2>
		<ModalCloseButton label="상세 필터 닫기" onclick={cancel} />
	</div>
	{@render children(cancel)}
</dialog>

<style>
	.lc-filter-dialog[data-modal-phase='opening']::backdrop {
		animation: lc-modal-backdrop-in 200ms cubic-bezier(0.215, 0.61, 0.355, 1) both;
	}
	.lc-filter-dialog[data-modal-phase='closing']::backdrop {
		animation: lc-modal-backdrop-out 150ms ease-in both;
	}
	@keyframes lc-modal-backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes lc-modal-backdrop-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lc-filter-dialog::backdrop {
			animation: none !important;
		}
	}
</style>
