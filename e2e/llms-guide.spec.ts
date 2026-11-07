import { expect, test } from '@playwright/test';

test('publishes the public archive guide and links it from the home page', async ({
	page,
	request
}) => {
	await page.goto('/');
	await expect(page.locator('head link[rel="describedby"]')).toHaveAttribute('href', '/llms.txt');
	const guide = await request.get('/llms.txt');
	expect(guide.ok()).toBe(true);
	expect(guide.headers()['content-type']).toMatch(/^text\/plain\b/);
	const body = await guide.text();
	expect(body).toMatch(/^# LawCast\r?\n/);
	expect(body).toContain('https://law.viento.me/notices');
	expect(body).toContain('https://law.viento.me/sitemap.xml');
	expect(body).toContain('https://law.viento.me/robots.txt');
});
