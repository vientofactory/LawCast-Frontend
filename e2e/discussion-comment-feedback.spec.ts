import { expect, test } from '@playwright/test';

const threadPath = '/notices/2210001/discussions/221000101';
test.use({ serviceWorkers: 'block' });

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`matches the loading skeleton to open comments at ${width}px in ${theme}`, async ({
			page
		}, testInfo) => {
			let release!: () => void;
			const responseGate = new Promise<void>((resolve) => (release = resolve));
			await page.route('**/api/discussions/threads/221000101?**', async (route) => {
				if (Number(new URL(route.request().url()).searchParams.get('cursor')) > 0) {
					await responseGate;
				}
				await route.continue();
			});
			try {
				await page.setViewportSize({ width, height: 1000 });
				await page.addInitScript((theme) => localStorage.setItem('lawcast-theme', theme), theme);
				await page.goto(threadPath);
				await expect(page.getByTestId('discussion-comment-1')).toBeVisible();
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
				await page.getByTestId('discussion-reply-form').scrollIntoViewIfNeeded();
				const loading = page.getByTestId('discussion-comment-skeletons');
				await expect(loading).toBeVisible();
				await expect(loading).toHaveAttribute('role', 'status');
				const skeleton = page.getByTestId('discussion-comment-skeleton').first();
				await expect(page.getByTestId('discussion-comment-skeleton')).toHaveCount(3);
				await expect(skeleton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				await expect(skeleton).toHaveCSS('border-radius', '0px');
				await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
				const geometry = await page.evaluate(() => {
					const row = document.querySelector('[data-testid="discussion-comment-1"]')!;
					const skeleton = document.querySelector('[data-testid="discussion-comment-skeleton"]')!;
					const rect = (id: string) =>
						skeleton.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
					return {
						header: row.querySelector('header')!.getBoundingClientRect().height,
						skeletonHeader: rect('discussion-skeleton-header').height,
						actionGap:
							rect('discussion-skeleton-actions').top - rect('discussion-skeleton-body').bottom,
						actionHeight: rect('discussion-skeleton-actions').height,
						rowPadding: getComputedStyle(row).padding,
						skeletonPadding: getComputedStyle(skeleton).padding,
						buttons: skeleton.querySelectorAll('button').length
					};
				});
				expect(geometry.skeletonHeader).toBe(geometry.header);
				expect(geometry.skeletonPadding).toBe(geometry.rowPadding);
				expect(geometry.actionGap).toBe(12);
				expect(geometry.actionHeight).toBe(44);
				expect(geometry.buttons).toBe(0);
				if (width === 320)
					await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
				await skeleton.scrollIntoViewIfNeeded();
				await page.screenshot({ path: testInfo.outputPath(`skeleton-${width}-${theme}.png`) });
			} finally {
				release();
			}
			await expect(page.getByTestId('discussion-comment-21')).toBeAttached();
			await expect(page.getByTestId('discussion-comment-skeletons')).toHaveCount(0);
		});
	}
}

for (const theme of ['light', 'dark']) {
	for (const reducedMotion of ['no-preference', 'reduce'] as const) {
		test(`highlights the quote destination after arrival in ${theme} with ${reducedMotion} motion`, async ({
			page
		}, testInfo) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width: 390, height: 1000 });
			await page.addInitScript((theme) => localStorage.setItem('lawcast-theme', theme), theme);
			await page.goto(threadPath);
			await expect(page.getByTestId('discussion-comment-1')).toBeVisible();
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			const target = page.getByTestId('discussion-comment-7');
			const geometry = await target.evaluate((node) => ({
				width: node.clientWidth,
				height: node.clientHeight
			}));
			await page
				.getByTestId('discussion-comment-9')
				.getByRole('button', { name: /7번 의견/ })
				.click();
			await expect(target).toHaveClass(/lc-comment-highlight/);
			await expect(target).toBeInViewport();
			await expect
				.poll(() => target.evaluate((node) => getComputedStyle(node, '::before').opacity))
				.toBe('1');
			const visual = await target.evaluate((node) => {
				const style = getComputedStyle(node, '::before');
				return {
					color: style.backgroundColor,
					marker: style.borderInlineStartWidth,
					events: style.pointerEvents,
					width: node.clientWidth,
					height: node.clientHeight,
					animation: style.animationName,
					transition: style.transitionDuration
				};
			});
			expect(visual.color).not.toBe('rgba(0, 0, 0, 0)');
			expect(visual.marker).toBe('3px');
			expect(visual.events).toBe('none');
			expect(visual.animation).toBe('none');
			if (reducedMotion === 'reduce') expect(visual.transition).toBe('0s');
			expect({ width: visual.width, height: visual.height }).toEqual(geometry);
			await page.screenshot({
				path: testInfo.outputPath(`highlight-${theme}-${reducedMotion}.png`)
			});
			// Repeating the jump must restart its lifetime rather than reuse an old timer.
			await page.waitForTimeout(1200);
			await page.getByTestId('discussion-comment-number-7').click();
			await page.waitForTimeout(1200);
			await expect(target).toHaveClass(/lc-comment-highlight/);
			await expect(target).not.toHaveClass(/lc-comment-highlight/, { timeout: 4000 });
			await expect
				.poll(() => target.evaluate((node) => getComputedStyle(node, '::before').opacity))
				.toBe('0');
		});
	}
}

test('highlights the last borderless comment and clears the previous destination', async ({
	page
}) => {
	await page.goto(threadPath);
	await expect(async () => {
		await page.getByTestId('discussion-reply-form').scrollIntoViewIfNeeded();
		await expect(page.getByTestId('discussion-comment-54')).toBeAttached({ timeout: 1000 });
	}).toPass();
	const last = page.getByTestId('discussion-comment-54');
	await expect(last).toHaveCSS('border-bottom-width', '0px');
	await page.getByTestId('discussion-comment-number-54').click();
	await expect(last).toHaveClass(/lc-comment-highlight/);
	await expect
		.poll(() => last.evaluate((node) => getComputedStyle(node, '::before').opacity))
		.toBe('1');
	await page.getByTestId('discussion-comment-number-53').click();
	await expect(last).not.toHaveClass(/lc-comment-highlight/);
	await expect(page.getByTestId('discussion-comment-53')).toHaveClass(/lc-comment-highlight/);
});
