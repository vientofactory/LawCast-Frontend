/** Cycle modal controls explicitly, including browsers with selective native Tab navigation. */
export function trapModalTab(event: KeyboardEvent, root: HTMLElement) {
	if (event.key !== 'Tab') return;
	const controls = Array.from(
		root.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
		)
	).filter((element) => {
		if (!element.getClientRects().length || element.tabIndex < 0 || element.closest('[inert]'))
			return false;
		const style = getComputedStyle(element);
		if (style.visibility === 'hidden' || style.display === 'none') return false;
		if (element instanceof HTMLInputElement && element.type === 'radio' && element.name) {
			const group = Array.from(
				root.querySelectorAll<HTMLInputElement>('input[type="radio"]')
			).filter(
				(radio) => radio.name === element.name && radio.form === element.form && !radio.disabled
			);
			return element === (group.find((radio) => radio.checked) ?? group[0]);
		}
		return true;
	});
	event.preventDefault();
	if (!controls.length) {
		root.focus();
		return;
	}
	const index = controls.indexOf(document.activeElement as HTMLElement);
	const next =
		index < 0
			? event.shiftKey
				? controls.length - 1
				: 0
			: (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
	controls[next].focus();
}

/** Isolate a custom modal without changing its existing transition lifecycle. */
export function modalFocus(node: HTMLElement, { returnFocus }: { returnFocus?: HTMLElement } = {}) {
	const previousFocus = returnFocus ?? (document.activeElement as HTMLElement | null);
	const previousOverflow = document.body.style.overflow;
	const isolated: { element: HTMLElement; inert: boolean }[] = [];
	let branch: HTMLElement = node.parentElement!;
	while (branch?.parentElement) {
		for (const sibling of Array.from(branch.parentElement.children)) {
			if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
			isolated.push({ element: sibling, inert: sibling.inert });
			sibling.inert = true;
		}
		branch = branch.parentElement;
	}
	document.body.style.overflow = 'hidden';
	const first = node.querySelector<HTMLElement>(
		'[autofocus], button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
	);
	(first ?? node).focus();
	const trap = (event: KeyboardEvent) => trapModalTab(event, node);
	node.addEventListener('keydown', trap);
	return {
		destroy() {
			node.removeEventListener('keydown', trap);
			for (const { element, inert } of isolated) element.inert = inert;
			document.body.style.overflow = previousOverflow;
			if (
				previousFocus?.isConnected &&
				!previousFocus.closest('[inert]') &&
				previousFocus.getClientRects().length
			)
				previousFocus.focus({ preventScroll: true });
		}
	};
}
