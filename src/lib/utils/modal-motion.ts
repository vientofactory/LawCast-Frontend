import { cubicIn, cubicOut } from 'svelte/easing';

export const MODAL_ENTER_MS = 200;
export const MODAL_EXIT_MS = 150;

export function reducedModalMotion() {
	return (
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

export function modalPanel(_node: Element, { exiting = false } = {}) {
	return {
		duration: reducedModalMotion() ? 0 : exiting ? MODAL_EXIT_MS : MODAL_ENTER_MS,
		easing: exiting ? cubicIn : cubicOut,
		css: (t: number) =>
			`opacity: ${t}; transform: translateY(${8 * (1 - t)}px) scale(${0.97 + 0.03 * t});`
	};
}

export function modalBackdrop(_node: Element, { exiting = false } = {}) {
	return {
		duration: reducedModalMotion() ? 0 : exiting ? MODAL_EXIT_MS : MODAL_ENTER_MS,
		easing: exiting ? cubicIn : cubicOut,
		css: (t: number) => `opacity: ${t};`
	};
}

/** Keep a native dialog in the top layer until its exit animation has completed. */
export function animateNativeModal(
	node: HTMLDialogElement,
	opening: boolean,
	from?: { opacity: string; transform: string }
) {
	if (reducedModalMotion()) return null;
	return node.animate(
		[
			from ?? {
				opacity: opening ? '0' : '1',
				transform: opening ? 'translateY(8px) scale(0.97)' : 'none'
			},
			{ opacity: opening ? '1' : '0', transform: opening ? 'none' : 'translateY(6px) scale(0.97)' }
		],
		{
			duration: opening ? MODAL_ENTER_MS : MODAL_EXIT_MS,
			easing: opening
				? 'cubic-bezier(0.215, 0.61, 0.355, 1)'
				: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
			fill: 'both'
		}
	);
}
