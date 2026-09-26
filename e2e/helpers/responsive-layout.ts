import { expect, type Locator, type Page } from '@playwright/test';

export async function prepareResponsivePage(
	page: Page,
	viewport: { width: number; height: number }
) {
	await page.setViewportSize(viewport);
	await page.route('**/api/push/public-key', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				data: { enabled: true, publicKey: 'BFakeE2EVapidPublicKey' }
			})
		})
	);
}

export async function maxTextNodeLines(locator: Locator): Promise<number> {
	return locator.evaluate((element) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let maxLines = 0;
		while (walker.nextNode()) {
			if (!walker.currentNode.textContent?.trim()) continue;
			const range = document.createRange();
			range.selectNodeContents(walker.currentNode);
			maxLines = Math.max(maxLines, range.getClientRects().length);
		}
		return maxLines;
	});
}

export async function expectNoClippedText(page: Page, path: string): Promise<void> {
	const clippedText = await page.locator('main *').evaluateAll((elements) =>
		elements.flatMap((element) => {
			const style = getComputedStyle(element);
			const clipsX = ['hidden', 'clip'].includes(style.overflowX);
			const clipsY = ['hidden', 'clip'].includes(style.overflowY);
			if (!clipsX && !clipsY) return [];
			const bounds = element.getBoundingClientRect();
			const clipLeft = bounds.left + Number.parseFloat(style.borderLeftWidth);
			const clipRight = bounds.right - Number.parseFloat(style.borderRightWidth);
			const clipTop = bounds.top + Number.parseFloat(style.borderTopWidth);
			const clipBottom = bounds.bottom - Number.parseFloat(style.borderBottomWidth);
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				if (!walker.currentNode.textContent?.trim()) continue;
				if (walker.currentNode.parentElement?.closest('.sr-only')) continue;
				const textStyle = getComputedStyle(walker.currentNode.parentElement!);
				if (textStyle.textOverflow === 'ellipsis' || textStyle.webkitLineClamp !== 'none') continue;
				const range = document.createRange();
				range.selectNodeContents(walker.currentNode);
				for (const rect of range.getClientRects()) {
					if (
						(clipsX && (rect.left < clipLeft - 1 || rect.right > clipRight + 1)) ||
						(clipsY && (rect.top < clipTop - 1 || rect.bottom > clipBottom + 1))
					) {
						return [`${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`];
					}
				}
			}
			return [];
		})
	);
	expect(clippedText, `${path}: clipped text`).toEqual([]);
}

export async function expectRouteWithinBounds(page: Page, path: string): Promise<void> {
	const bounds = await page.evaluate(() => ({
		viewportWidth: document.documentElement.clientWidth,
		documentWidth: document.documentElement.scrollWidth,
		mainWidth: document.querySelector('main')!.clientWidth,
		mainScrollWidth: document.querySelector('main')!.scrollWidth
	}));
	expect(bounds.documentWidth, `${path}: horizontal page overflow`).toBeLessThanOrEqual(
		bounds.viewportWidth + 1
	);
	expect(bounds.mainScrollWidth, `${path}: main content overflow`).toBeLessThanOrEqual(
		bounds.mainWidth + 1
	);
	await expectNoClippedText(page, path);

	const footer = page.locator('footer');
	await footer.scrollIntoViewIfNeeded();
	await expect(footer).toBeInViewport();
}
