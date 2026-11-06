interface DividerRule {
	selector: string;
	edge: string;
	x: number;
	right: number;
	y: number;
	width: number;
	text: string;
}

// Run inside the page: closed controls, outlined panels and intervening text are not duplicate rules.
export function findSectionDividers() {
	const main = document.querySelector('main');
	if (!main) return { rules: [], pairs: [] };
	const rules: DividerRule[] = [];
	const selector = (e: Element) =>
		e.getAttribute('data-testid')
			? `[data-testid="${e.getAttribute('data-testid')}"]`
			: e.tagName.toLowerCase() + '.' + [...e.classList].join('.');
	const range = document.createRange();
	const textRects: { x: number; right: number; y: number; bottom: number }[] = [];
	const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
	});
	while (walker.nextNode()) {
		const node = walker.currentNode,
			el = node.parentElement;
		if (
			!el ||
			!el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) ||
			el.closest('script,style,[aria-hidden="true"],.sr-only')
		)
			continue;
		range.selectNodeContents(node);
		for (const r of range.getClientRects())
			if (r.width > 2 && r.height > 2)
				textRects.push({ x: r.x, right: r.right, y: r.y + scrollY, bottom: r.bottom + scrollY });
	}
	for (const e of main.querySelectorAll('*')) {
		const c = getComputedStyle(e),
			r = e.getBoundingClientRect();
		if (
			!e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) ||
			r.width < Math.min(240, main.clientWidth * 0.65) ||
			r.height === 0 ||
			c.visibility === 'hidden' ||
			c.display === 'none' ||
			e.closest('dialog,input,button,select,textarea')
		)
			continue;
		// Closed panel outlines are not open-section separators.
		if (parseFloat(c.borderLeftWidth) > 0 && parseFloat(c.borderRightWidth) > 0) continue;
		for (const edge of ['Top', 'Bottom'] as const) {
			const width = parseFloat(c[`border${edge}Width`]),
				color = c[`border${edge}Color`];
			if (
				width > 0 &&
				c[`border${edge}Style`] !== 'none' &&
				color !== 'transparent' &&
				!/rgba\([^)]*,\s*0\)/.test(color)
			)
				rules.push({
					selector: selector(e),
					edge: edge.toLowerCase(),
					x: r.x,
					right: r.right,
					y: (edge === 'Top' ? r.top : r.bottom - width) + scrollY,
					width,
					text: (e.textContent ?? '').trim().slice(0, 70)
				});
		}
		if (e.tagName === 'HR' && parseFloat(c.borderTopWidth) === 0 && r.height < 5)
			rules.push({
				selector: selector(e),
				edge: 'hr',
				x: r.x,
				right: r.right,
				y: r.y + scrollY,
				width: r.height,
				text: ''
			});
	}
	rules.sort((a, b) => a.y - b.y);
	const pairs = [];
	for (let i = 0; i < rules.length; i++)
		for (let j = i + 1; j < rules.length; j++) {
			const a = rules[i],
				b = rules[j],
				gap = b.y - a.y - a.width;
			if (gap > 64) break;
			const x = Math.max(a.x, b.x),
				right = Math.min(a.right, b.right),
				overlap = right - x;
			if (gap < -0.5 || overlap / Math.max(a.right - a.x, b.right - b.x) < 0.85) continue;
			const content = textRects.some(
				(r) => r.bottom > a.y + a.width + 1 && r.y < b.y - 1 && r.right > x + 4 && r.x < right - 4
			);
			if (!content) pairs.push({ a, b, gap });
		}
	return { rules, pairs };
}
