import { cubicOut } from 'svelte/easing';
import { reducedModalMotion } from './modal-motion';

/** A reversible transition keeps outgoing prompt content mounted until it finishes. */
export function floatingPrompt(_node: Element, { distance = 12, duration = 200 } = {}) {
	return {
		duration: reducedModalMotion() ? 0 : duration,
		easing: cubicOut,
		css: (t: number) => `opacity: ${t}; transform: translateY(${distance * (1 - t)}px);`
	};
}
