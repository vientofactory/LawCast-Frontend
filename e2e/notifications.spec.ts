import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => {
	await page.goto('/notification-test');
	await expect(page.getByRole('button', { name: '성공 알림', exact: true })).toBeEnabled();
});
for (const width of [320, 820, 1440])
	for (const theme of ['light', 'dark']) {
		test(`stacks themed notifications at ${width}px in ${theme}`, async ({ page }, info) => {
			await page.setViewportSize({ width, height: 900 });
			await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
			await page.getByRole('button', { name: '성공 알림', exact: true }).click();
			await page.getByRole('button', { name: '경고 알림', exact: true }).click();
			await page.getByRole('button', { name: '오류 알림', exact: true }).click();
			const cards = page.locator('[data-notification-type]');
			await expect(cards).toHaveCount(3);
			await expect(cards.first()).toHaveAttribute('role', 'status');
			await expect(cards.last()).toHaveAttribute('role', 'alert');
			await expect(cards.first()).toHaveCSS(
				'border-left-color',
				theme === 'dark' ? 'rgb(191, 232, 209)' : 'rgb(21, 128, 61)'
			);
			await expect(cards.last()).toHaveCSS(
				'border-left-color',
				theme === 'dark' ? 'rgb(252, 165, 165)' : 'rgb(185, 28, 28)'
			);
			await page.evaluate(async () => {
				await Promise.all(document.getAnimations().map((animation) => animation.finished));
			});
			const host = page.getByTestId('notification-viewport').filter({ has: cards.first() });
			await expect(host).toHaveCSS('position', 'fixed');
			const bounds = await host.boundingBox();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
			expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
			for (const close of await cards.getByRole('button', { name: '알림 닫기' }).all()) {
				const rect = await close.boundingBox();
				expect(rect!.width).toBeGreaterThanOrEqual(44);
				expect(rect!.height).toBeGreaterThanOrEqual(44);
			}
			expect(
				(await new AxeBuilder({ page }).include('[data-notification-scope-host="page"]').analyze())
					.violations
			).toEqual([]);
			if (process.env.UI_SCREENSHOT_DIR) {
				const folder = join(process.env.UI_SCREENSHOT_DIR, info.project.name);
				await mkdir(folder, { recursive: true });
				await page.screenshot({ path: join(folder, `notifications-${width}-${theme}.png`) });
			}
			await cards.nth(1).getByRole('button', { name: '알림 닫기' }).click();
			await expect(cards).toHaveCount(2);
			await page.evaluate(
				(value) => (document.documentElement.dataset.theme = value),
				theme === 'dark' ? 'light' : 'dark'
			);
			await expect(cards.first()).toHaveCSS(
				'background-color',
				theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(48, 49, 50)'
			);
		});
	}

test('queues excess notifications without starting their expiry early', async ({ page }) => {
	await page.clock.install();
	await page.getByRole('button', { name: '동시 알림', exact: true }).click();
	await expect(page.locator('[data-notification-type]')).toHaveCount(3);
	await expect(page.getByText('대기 중인 알림 2개')).toBeVisible();
	await page.mouse.move(0, 0);
	await page.clock.fastForward(6200);
	await expect(page.locator('[data-notification-type]')).toHaveCount(2);
	await expect(page.getByText('동시 알림 4', { exact: true })).toBeVisible();
	await page.clock.fastForward(6200);
	await expect(page.locator('[data-notification-type]')).toHaveCount(0);
});

test('pauses expiry while hovered or keyboard focused and supports actions', async ({ page }) => {
	await page.clock.install();
	await page.getByRole('button', { name: '성공 알림', exact: true }).focus();
	await page.getByRole('button', { name: '성공 알림', exact: true }).press('Enter');
	const card = page.getByTestId('notification');
	await card.hover();
	await page.clock.fastForward(10000);
	await expect(card).toBeVisible();
	const action = card.getByRole('button', { name: '다시 시도' });
	await action.focus();
	await page.mouse.move(0, 0);
	await page.clock.fastForward(10000);
	await expect(card).toBeVisible();
	await action.press('Enter');
	await expect(page.getByTestId('action-count')).toHaveText('1');
	await card.getByRole('button', { name: '알림 닫기' }).focus();
	await page.keyboard.press('Enter');
	await page.clock.fastForward(200);
	await expect(card).toHaveCount(0);
	await expect(page.getByRole('button', { name: '성공 알림', exact: true })).toBeFocused();
});

test('scopes modal notifications inside the focus trap and cleans up on close', async ({
	page
}) => {
	await page.clock.install();
	await page.getByRole('button', { name: '오류 알림', exact: true }).click();
	await page.getByRole('button', { name: '모달 열기' }).click();
	await page.clock.fastForward(10000);
	await expect(page.locator('[data-notification-type]')).toHaveCount(1);
	const modal = page.getByTestId('notification-test-modal');
	await modal.getByRole('button', { name: '모달 오류', exact: true }).focus();
	await modal.getByRole('button', { name: '모달 오류', exact: true }).press('Enter');
	const card = modal.getByTestId('notification');
	await expect(card).toContainText('모달 오류 알림');
	await card.getByRole('button', { name: '알림 닫기' }).focus();
	await page.keyboard.press('Tab');
	await expect(modal.getByTestId('modal-close')).toBeFocused();
	await card.getByRole('button', { name: '알림 닫기' }).focus();
	await card.getByRole('button', { name: '알림 닫기' }).press('Enter');
	await expect(card).toHaveCount(0);
	await expect(modal.getByRole('button', { name: '모달 오류', exact: true })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(modal).toHaveCount(0);
	await expect(page.locator('[data-notification-type]')).toHaveCount(1);
});

test('uses the shared notification for repeated real form validation errors', async ({ page }) => {
	await page.getByRole('button', { name: '토론 폼 열기' }).click();
	const modal = page.getByTestId('discussion-new-thread-modal');
	await modal
		.locator('form')
		.evaluate((form: HTMLFormElement) =>
			form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
		);
	const error = modal.getByTestId('discussion-new-thread-error');
	await expect(error).toContainText('토론 주제를 2자 이상');
	await error.getByRole('button', { name: '알림 닫기' }).click();
	await expect(error).toHaveCount(0);
	await modal
		.locator('form')
		.evaluate((form: HTMLFormElement) =>
			form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
		);
	await expect(error).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(error).toHaveCount(0);
});

test('touch notification close remains usable with reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.getByRole('button', { name: '성공 알림', exact: true }).tap();
	const card = page.getByTestId('notification');
	await expect(card).toBeVisible();
	await card.getByRole('button', { name: '알림 닫기' }).tap();
	await expect(card).toHaveCount(0);
});

test('expires success warning and error notifications with independent durations', async ({
	page
}) => {
	await page.clock.install();
	for (const name of ['성공 알림', '경고 알림', '오류 알림'])
		await page.getByRole('button', { name, exact: true }).click();
	await page.mouse.move(0, 0);
	await page.clock.fastForward(5200);
	await expect(page.locator('[data-notification-type="success"]')).toHaveCount(0);
	await expect(page.locator('[data-notification-type]')).toHaveCount(2);
	await page.clock.fastForward(2000);
	await expect(page.locator('[data-notification-type="warning"]')).toHaveCount(0);
	await expect(page.locator('[data-notification-type="error"]')).toHaveCount(1);
	await page.clock.fastForward(1000);
	await expect(page.locator('[data-notification-type]')).toHaveCount(0);
});

test('migrates webhook validation feedback and cleans it up after navigation', async ({ page }) => {
	await page.addInitScript(() => Reflect.deleteProperty(window, 'PushManager'));
	await page.route('**/api/push/public-key', (route) =>
		route.fulfill({ json: { success: true, data: { enabled: false, publicKey: '' } } })
	);
	await page.goto('/webhook');
	await page.getByRole('textbox', { name: '웹훅 URL *', exact: true }).fill('https://example.com');
	await page.getByRole('button', { name: '웹훅 등록', exact: true }).click();
	const card = page.getByTestId('notification');
	await expect(card).toBeVisible();
	await expect(card).toHaveAttribute('data-notification-type', 'error');
	await card.getByRole('button', { name: '알림 닫기' }).click();
	await expect(card).toHaveCount(0);
	await page.getByRole('button', { name: '웹훅 등록', exact: true }).click();
	await expect(card).toBeVisible();
	await page.locator('a[href="/notices"]').first().click();
	await expect(page).toHaveURL(/\/notices/);
	await expect(card).toHaveCount(0);
});

test('keeps notification controls clear of the installation offer', async ({ page }) => {
	await page.evaluate(() => {
		const event = new Event('beforeinstallprompt', { cancelable: true });
		Object.assign(event, {
			prompt: async () => {},
			userChoice: Promise.resolve({ outcome: 'dismissed' })
		});
		window.dispatchEvent(event);
	});
	const offer = page.getByTestId('pwa-install-prompt');
	await expect(offer).toBeVisible();
	await page.getByRole('button', { name: '성공 알림', exact: true }).click();
	await expect
		.poll(async () => {
			const toast = await page.getByTestId('notification').boundingBox();
			const prompt = await offer.boundingBox();
			return toast!.y + toast!.height <= prompt!.y;
		})
		.toBe(true);
	await page.getByTestId('pwa-install-dismiss').click();
	await expect(offer).toHaveCount(0);
	await expect
		.poll(() =>
			page.evaluate(() =>
				document.documentElement.style.getPropertyValue('--lc-install-prompt-space')
			)
		)
		.toBe('');
});

test('retains field errors after toast expiry and clears only corrected validation state', async ({
	page
}) => {
	await page.clock.install();
	await page.getByRole('button', { name: '토론 폼 열기' }).click();
	const modal = page.getByTestId('discussion-new-thread-modal');
	const submit = () =>
		modal
			.locator('form')
			.evaluate((form: HTMLFormElement) =>
				form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
			);
	const fields = [
		{ name: 'title', value: '검증할 토론', message: '토론 주제를 2자 이상' },
		{ name: 'password', value: '1234', message: '비밀번호를 4자 이상' },
		{ name: 'content', value: '검증할 의견', message: '첫 발언 내용을 2자 이상' }
	];
	for (const field of fields) {
		await submit();
		const input = modal.getByTestId(`discussion-new-thread-${field.name}`);
		await expect(input).toHaveAttribute('aria-invalid', 'true');
		await expect(input).toHaveAttribute('aria-describedby', 'thread-validation-error');
		const description = modal.locator('#thread-validation-error');
		await expect(description).toContainText(field.message);
		await modal.getByTestId('discussion-new-thread-nickname').fill('테스터');
		await expect(input).toHaveAttribute('aria-invalid', 'true');
		await page.mouse.move(0, 0);
		await page.clock.fastForward(9000);
		await expect(modal.getByTestId('discussion-new-thread-error')).toHaveCount(0);
		await expect(description).toBeVisible();
		await submit();
		await expect(modal.getByTestId('discussion-new-thread-error')).toBeVisible();
		await modal
			.getByTestId('discussion-new-thread-error')
			.getByRole('button', { name: '알림 닫기' })
			.click();
		await expect(description).toBeVisible();
		await input.fill(field.value);
		await expect(description).toHaveCount(0);
		await expect(input).toHaveAttribute('aria-invalid', 'false');
	}
	await page.keyboard.press('Escape');
	await expect(modal).toHaveCount(0);
});

test('associates the persistent webhook validation hint with its input', async ({ page }) => {
	await page.goto('/webhook');
	const input = page.getByRole('textbox', { name: '웹훅 URL *', exact: true });
	await input.fill('https://example.com');
	await expect(input).toHaveAttribute('aria-invalid', 'true');
	await expect(input).toHaveAttribute('aria-describedby', 'webhook-url-error');
	await expect(page.locator('#webhook-url-error')).toBeVisible();
	await input.fill('');
	await expect(input).toHaveAttribute('aria-invalid', 'false');
	await expect(input).not.toHaveAttribute('aria-describedby');
});
