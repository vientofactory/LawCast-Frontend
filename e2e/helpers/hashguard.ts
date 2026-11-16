import type { BrowserContext } from '@playwright/test';

/** Intercept SDK traffic at context level so Web Worker requests are included. */
export async function installHashguardMock(context: BrowserContext) {
	let count = 0;
	await context.route('**/v1/pow/**', async (route) => {
		if (route.request().method() === 'OPTIONS') {
			await route.fulfill({
				status: 204,
				headers: {
					'access-control-allow-origin': '*',
					'access-control-allow-headers': 'content-type'
				}
			});
			return;
		}
		if (!route.request().url().endsWith('/assessments')) {
			await route.fulfill({ status: 501, json: { message: 'Unexpected Hashguard call' } });
			return;
		}
		const { context: label } = route.request().postDataJSON();
		await route.fulfill({
			headers: { 'access-control-allow-origin': '*' },
			json: {
				action: 'allow',
				riskScore: 0,
				verification: {
					proofToken: `assertion-${label}-${++count}`,
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			}
		});
	});
}
