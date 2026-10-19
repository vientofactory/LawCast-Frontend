import { expect, test, type Page } from '@playwright/test';

async function queue(page: Page) {
	return page.evaluate(() =>
		(window.dataLayer ?? []).map((entry) => {
			if (Object.prototype.toString.call(entry) === '[object Arguments]') {
				return { type: 'command', args: Array.from(entry as IArguments) };
			}
			return { type: 'event', value: entry as Record<string, string> };
		})
	);
}

async function pageViews(page: Page) {
	return (await queue(page)).filter(
		(entry) => entry.type === 'event' && entry.value?.event === 'virtual_pageview'
	);
}

async function expectConsent(page: Page, state: 'granted' | 'denied') {
	await expect
		.poll(async () => (await queue(page)).filter((entry) => entry.type === 'command').at(-1))
		.toEqual({
			type: 'command',
			args: [
				'consent',
				'update',
				{
					ad_storage: 'denied',
					ad_user_data: 'denied',
					ad_personalization: 'denied',
					analytics_storage: state
				}
			]
		});
}

async function choose(page: Page, choice: 'accept' | 'decline') {
	await expect(async () => {
		await page.getByTestId(`cookie-consent-${choice}`).click({ timeout: 1000 });
		await expect(page.getByTestId('cookie-consent-banner')).toBeHidden({ timeout: 1000 });
	}).toPass();
}

test.beforeEach(async ({ page }, testInfo) => {
	test.skip(
		testInfo.project.name !== 'analytics-consent',
		'Requires the dedicated analytics config.'
	);
	// Keep Google network calls out of isolated regression tests.
	await page.route('https://www.googletagmanager.com/**', (route) =>
		route.fulfill({ contentType: 'application/javascript', body: '' })
	);
});

test('does not send pageviews while consent is denied or declined', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	await expectConsent(page, 'denied');
	const entries = await queue(page);
	expect(entries[0]).toEqual({
		type: 'command',
		args: [
			'consent',
			'default',
			{
				ad_storage: 'denied',
				ad_user_data: 'denied',
				ad_personalization: 'denied',
				analytics_storage: 'denied'
			}
		]
	});
	expect(entries[1].value?.event).toBe('gtm.js');
	expect(await pageViews(page)).toHaveLength(0);
	await choose(page, 'decline');
	await page.reload();
	await expectConsent(page, 'denied');
	await page.getByTestId('nav-link-notices').click();
	await expect(page).toHaveURL(/\/notices$/);
	expect(await pageViews(page)).toHaveLength(0);
});

test('records the initial pageview and one SPA navigation after consent without duplicating on re-consent', async ({
	page
}) => {
	await page.goto('/');
	await choose(page, 'accept');
	await expectConsent(page, 'granted');
	await expect.poll(async () => (await pageViews(page)).length).toBe(1);
	await page.getByTestId('nav-link-notices').click();
	await expect(page).toHaveURL(/\/notices$/);
	await expect.poll(async () => (await pageViews(page)).length).toBe(2);
	const last = (await pageViews(page)).at(-1)?.value;
	expect(last?.page_location).toBe('http://localhost:5193/notices');
	expect(last?.page_path).toBe('/notices');
	expect(last?.page_title).toContain('전체 입법예고');
	await page.getByTestId('cookie-settings-button').click();
	await choose(page, 'accept');
	expect(await pageViews(page)).toHaveLength(2);
});

test('restores consent before GTM loads on revisit and records the first page once', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('lawcast-cookie-consent', 'accepted'));
	await page.goto('/');
	await expectConsent(page, 'granted');
	await expect.poll(async () => (await pageViews(page)).length).toBe(1);
	const entries = await queue(page);
	expect(entries[0].args?.[1]).toBe('default');
	expect(entries[1].args?.[1]).toBe('update');
	expect(entries[1].args?.[2].analytics_storage).toBe('granted');
	expect(entries[2].value?.event).toBe('gtm.js');
	expect(entries.filter((entry) => entry.args?.[1] === 'default')).toHaveLength(1);
	await expect(page.getByTestId('cookie-consent-banner')).toBeHidden();
});

test('stops sending follow-up SPA pageviews after consent is withdrawn', async ({ page }) => {
	await page.goto('/');
	await choose(page, 'accept');
	await expectConsent(page, 'granted');
	await page.getByTestId('cookie-settings-button').click();
	await choose(page, 'decline');
	await expectConsent(page, 'denied');
	await page.getByTestId('nav-link-notices').click();
	await expect(page).toHaveURL(/\/notices$/);
	expect(await pageViews(page)).toHaveLength(1);
	await page.reload();
	await expectConsent(page, 'denied');
	expect(await pageViews(page)).toHaveLength(0);
});

test('safely denies consent and pageviews when storage access is blocked', async ({ page }) => {
	await page.addInitScript(() => {
		const getItem = Storage.prototype.getItem;
		const setItem = Storage.prototype.setItem;
		Storage.prototype.getItem = function (key) {
			if (key === 'lawcast-cookie-consent') throw new DOMException('Blocked', 'SecurityError');
			return getItem.call(this, key);
		};
		Storage.prototype.setItem = function (key, value) {
			if (key === 'lawcast-cookie-consent') throw new DOMException('Blocked', 'SecurityError');
			return setItem.call(this, key, value);
		};
	});
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	await expectConsent(page, 'denied');
	await page.getByTestId('cookie-consent-accept').click();
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	expect(await pageViews(page)).toHaveLength(0);
});
