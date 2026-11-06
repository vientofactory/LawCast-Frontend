import { tick } from 'svelte';
import { cubicOut } from 'svelte/easing';
import { slide, fade } from 'svelte/transition';

export const DISCLOSURE_OPEN_MS = 240;
export const DISCLOSURE_CLOSE_MS = 180;
type Options = { onOpenChange?: (open: boolean) => void };
const controls = new WeakMap<HTMLDetailsElement, { settle: (open: boolean) => void }>();

/** Synchronize responsive/programmatic state immediately, including interrupted user motion. */
export function syncDisclosure(node: HTMLDetailsElement, open: boolean) {
	const control = controls.get(node);
	if (control) control.settle(open);
	else node.open = open;
}

/** Enhance native details without replacing its summary, keyboard semantics or child DOM. */
export function disclosureMotion(node: HTMLDetailsElement, options: Options = {}) {
	const summary = node.querySelector<HTMLElement>(':scope > summary');
	if (!summary) return {};
	const media = window.matchMedia('(prefers-reduced-motion: reduce)');
	const original = {
		height: node.style.height,
		overflow: node.style.overflow,
		overflowAnchor: node.style.overflowAnchor
	};
	let desired = node.open;
	let expectedOpen = node.open;
	let generation = 0;
	let animation: Animation | null = null;
	let indicatorAnimation: Animation | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let targetHeight = 0;
	let inertChildren: { node: HTMLElement; inert: boolean }[] = [];
	node.dataset.disclosureEnhanced = '';

	function stopIndicator() {
		indicatorAnimation?.cancel();
		indicatorAnimation = null;
	}
	function animateIndicator(open: boolean) {
		const indicator = summary!.querySelector<HTMLElement>('.lc-disclosure-indicator');
		if (!indicator) return;
		const from = getComputedStyle(indicator).transform;
		stopIndicator();
		const current = indicator.animate(
			[{ transform: from }, { transform: `rotate(${open ? 180 : 0}deg)` }],
			{ duration: DISCLOSURE_CLOSE_MS, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)', fill: 'both' }
		);
		indicatorAnimation = current;
		void current.finished.then(
			() => {
				if (indicatorAnimation === current) stopIndicator();
			},
			() => {}
		);
	}

	function restore() {
		clearTimeout(timer);
		animation?.cancel();
		animation = null;
		node.style.height = original.height;
		node.style.overflow = original.overflow;
		node.style.overflowAnchor = original.overflowAnchor;
		for (const child of inertChildren) child.node.inert = child.inert;
		inertChildren = [];
		delete node.dataset.disclosureState;
	}
	function nativeOpen(open: boolean) {
		expectedOpen = open;
		node.open = open;
	}
	function settle(open: boolean) {
		stopIndicator();
		delete node.dataset.disclosureAnimate;
		generation++;
		restore();
		desired = open;
		nativeOpen(open);
		options.onOpenChange?.(open);
	}
	function collapsedHeight() {
		const css = getComputedStyle(node);
		const header = getComputedStyle(summary!);
		return (
			summary!.getBoundingClientRect().height +
			parseFloat(css.paddingTop) +
			parseFloat(css.paddingBottom) +
			parseFloat(css.borderTopWidth) +
			parseFloat(css.borderBottomWidth) +
			parseFloat(header.marginTop) +
			parseFloat(header.marginBottom)
		);
	}
	function run(from: number, to: number, opening: boolean, token: number) {
		clearTimeout(timer);
		animation?.cancel();
		targetHeight = to;
		const duration = opening ? DISCLOSURE_OPEN_MS : DISCLOSURE_CLOSE_MS;
		const current = node.animate([{ height: `${from}px` }, { height: `${to}px` }], {
			duration,
			easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
			fill: 'both'
		});
		animation = current;
		const finish = () => {
			if (generation !== token || animation !== current) return;
			nativeOpen(opening);
			options.onOpenChange?.(opening);
			restore();
		};
		void current.finished.then(finish, () => {});
		// Offscreen deferred content can suspend presentation; never leave a stale height lock.
		timer = setTimeout(finish, duration + 120);
	}
	const resize = new ResizeObserver(() => {
		if (!animation || !desired) return;
		const css = getComputedStyle(node);
		const full =
			node.scrollHeight + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
		if (Math.abs(full - targetHeight) < 2) return;
		const from = node.getBoundingClientRect().height;
		animation.cancel();
		node.style.height = original.height;
		const to = node.getBoundingClientRect().height;
		node.style.height = `${from}px`;
		run(from, to, true, generation);
	});
	function observeChildren() {
		resize.disconnect();
		for (const child of node.children) resize.observe(child);
	}
	async function request(open: boolean) {
		node.dataset.disclosureAnimate = '';
		const from = node.getBoundingClientRect().height;
		generation++;
		const token = generation;
		restore();
		desired = open;
		if (media.matches) {
			settle(open);
			return;
		}
		// Only an explicit user request animates the indicator.
		animateIndicator(open);
		node.style.height = `${from}px`;
		node.style.overflow = 'hidden';
		node.style.overflowAnchor = 'none';
		node.dataset.disclosureState = open ? 'opening' : 'closing';
		if (open) {
			nativeOpen(true);
			options.onOpenChange?.(true);
		} else {
			if (node.contains(document.activeElement) && !summary!.contains(document.activeElement)) {
				summary!.focus({ preventScroll: true });
			}
			inertChildren = Array.from(node.children)
				.filter((child): child is HTMLElement => child instanceof HTMLElement && child !== summary)
				.map((child) => ({ node: child, inert: child.inert }));
			for (const child of inertChildren) child.node.inert = true;
		}
		await tick();
		if (token !== generation || !node.isConnected) return;
		observeChildren();
		let to = collapsedHeight();
		if (open) {
			node.style.height = original.height;
			to = node.getBoundingClientRect().height;
			node.style.height = `${from}px`;
		}
		run(from, to, open, token);
	}
	const click = (event: MouseEvent) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey ||
			event.shiftKey
		)
			return;
		const target = event.target;
		if (
			!(target instanceof Element) ||
			!summary.contains(target) ||
			target.closest('a,button,input,select,textarea,label,[contenteditable]')
		)
			return;
		event.preventDefault();
		void request(!desired);
	};
	const observer = new MutationObserver(() => {
		if (node.open === expectedOpen) return;
		stopIndicator();
		delete node.dataset.disclosureAnimate;
		generation++;
		restore();
		desired = expectedOpen = node.open;
	});
	const preference = () => {
		if (media.matches) settle(desired);
	};
	observer.observe(node, { attributes: true, attributeFilter: ['open'] });
	node.addEventListener('click', click);
	media.addEventListener('change', preference);
	controls.set(node, { settle });
	return {
		update(next: Options = {}) {
			options = next;
		},
		destroy() {
			stopIndicator();
			generation++;
			restore();
			observer.disconnect();
			resize.disconnect();
			node.removeEventListener('click', click);
			media.removeEventListener('change', preference);
			controls.delete(node);
			delete node.dataset.disclosureEnhanced;
			delete node.dataset.disclosureAnimate;
		}
	};
}

/** Matching motion for existing conditionally rendered, button-controlled disclosures. */
export function disclosureSlide(
	node: Element,
	{
		closing = false,
		duration = closing ? DISCLOSURE_CLOSE_MS : DISCLOSURE_OPEN_MS
	}: { closing?: boolean; duration?: number } = {}
) {
	return slide(node, {
		duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration,
		easing: cubicOut
	});
}
export function disclosureFade(node: Element, { duration = 140 } = {}) {
	return fade(node, {
		duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration
	});
}
