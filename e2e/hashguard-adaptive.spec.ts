import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

for (const fallback of [false, true]) {
	test.describe(fallback ? 'Adaptive main-thread fallback' : 'Adaptive worker', () => {
		test.beforeEach(async ({ page }) => {
			if (fallback) {
				await page.addInitScript(() => {
					Object.defineProperty(window, 'Worker', { value: undefined, configurable: true });
				});
			}
		});

		for (const decision of ['allow', 'challenge', '429', '503', 'empty', 'unknown']) {
			test(`handles ${decision} without bypassing assessment`, async ({ context, page }) => {
				const calls: string[] = [];
				const challengeId = 'test-challenge';
				const seed = 'ab'.repeat(32);
				await context.route('**/v1/pow/**', async (route) => {
					const req = route.request();
					const path = new URL(req.url()).pathname;
					const headers = {
						'access-control-allow-origin': '*',
						'access-control-allow-headers': 'content-type'
					};
					if (req.method() === 'OPTIONS') {
						await route.fulfill({ status: 204, headers });
						return;
					}
					calls.push(path);
					if (path.endsWith('/assessments')) {
						expect(req.postDataJSON()).toEqual({ context: 'discussion-comment' });
						if (decision === '429' || decision === '503') {
							await route.fulfill({
								status: Number(decision),
								headers,
								json: { code: 'TEST_UNAVAILABLE', message: '잠시 후 다시 시도해주세요.' }
							});
							return;
						}
						const verification = {
							proofToken: decision === 'empty' ? '' : 'test-assertion',
							expiresAt: new Date(Date.now() + 60_000).toISOString()
						};
						const body =
							decision === 'challenge'
								? {
										action: 'challenge',
										riskScore: 50,
										challenge: {
											challengeId,
											seed,
											algorithm: 'sha256',
											difficultyBits: 1,
											target: 'f'.repeat(64),
											issuedAt: new Date().toISOString(),
											expiresAt: verification.expiresAt
										}
									}
								: {
										action: decision === 'unknown' ? 'unknown' : 'allow',
										riskScore: 0,
										verification
									};
						await route.fulfill({ headers, json: body });
						return;
					}
					if (path.endsWith('/verifications')) {
						const body = req.postDataJSON();
						expect(body.challengeId).toBe(challengeId);
						expect(body.nonce).toMatch(/^\d+$/);
						expect(typeof body.clientMetrics.solveTimeMs).toBe('number');
						expect(
							createHash('sha256').update(`${challengeId}:${seed}:${body.nonce}`).digest('hex') <=
								'f'.repeat(64)
						).toBe(true);
						await route.fulfill({
							headers,
							json: {
								proofToken: 'test-assertion',
								expiresAt: new Date(Date.now() + 60_000).toISOString()
							}
						});
						return;
					}
					await route.fulfill({
						status: 501,
						headers,
						json: { message: 'Legacy endpoint must not be called' }
					});
				});
				await page.goto('/');
				const result = await page.evaluate(async () => {
					// @ts-expect-error Vite serves source modules directly in this browser-only contract test.
					const { executePowInWorker } = await import('/src/lib/hashguard-worker.ts');
					const phases: string[] = [];
					try {
						const proof = await executePowInWorker(
							'discussion-comment',
							(status: { phase: string }) => phases.push(status.phase)
						);
						return { proof, phases, status: 0, error: '' };
					} catch (error) {
						const failure = error as { status?: number; message: string };
						return { proof: '', phases, status: failure.status, error: failure.message };
					}
				});
				if (decision === 'allow' || decision === 'challenge') {
					expect(result.proof).toBe('test-assertion');
					expect(result.phases).toEqual(
						decision === 'allow'
							? ['assess', 'done']
							: ['assess', 'warmup', 'solve', 'verify', 'done']
					);
				} else {
					expect(result.proof).toBe('');
					expect(result.error).not.toBe('');
					expect(result.phases).toEqual(['assess']);
					if (decision === '429' || decision === '503')
						expect(result.status).toBe(Number(decision));
				}
				// Compare the leaf path so the assertion is independent of any base
				// URL prefix (the default origin-only base or an `/api/hashguard` proxy).
				const toTail = (p: string) => {
					const idx = p.lastIndexOf('/v1/pow/');
					return idx === -1 ? p : p.slice(idx);
				};
				expect(calls.map(toTail)).toEqual(
					decision === 'challenge'
						? ['/v1/pow/assessments', '/v1/pow/verifications']
						: ['/v1/pow/assessments']
				);
			});
		}
	});
}

test('clears stale PoW metrics for adaptive allow and completion', async ({ page }) => {
	await page.goto('/');
	const states = await page.evaluate(async () => {
		// @ts-expect-error Vite serves this source module in the browser-only contract test.
		const { applyPowStatus } = await import('/src/lib/utils/pow-status.ts');
		const stale = {
			message: 'Old work',
			attempts: 100,
			difficultyBits: 20,
			hashRate: 10,
			estimatedRemainingMs: 1000
		};
		return ['assess', 'done'].map((phase) =>
			applyPowStatus(stale, { phase, message: '보안 검증' })
		);
	});
	for (const state of states)
		expect(state).toEqual({
			message: '보안 검증',
			attempts: null,
			difficultyBits: null,
			hashRate: null,
			estimatedRemainingMs: null
		});
});

test('preserves the thread draft, prevents duplicate submission and obtains a fresh assertion on retry', async ({
	context,
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => localStorage.setItem('lawcast-theme', 'dark'));
	let attempts = 0;
	let writes = 0;
	let release: () => void = () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
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
		expect(route.request().url()).toContain('/assessments');
		expect(route.request().postDataJSON()).toEqual({ context: 'discussion-thread' });
		attempts++;
		if (attempts === 1) {
			await pending;
			await route.fulfill({
				status: 503,
				headers: { 'access-control-allow-origin': '*' },
				json: { code: 'UNAVAILABLE', message: '보안 검증을 잠시 후 다시 시도해주세요.' }
			});
		} else {
			await route.fulfill({
				headers: { 'access-control-allow-origin': '*' },
				json: {
					action: 'allow',
					riskScore: 0,
					verification: {
						proofToken: `fresh-${attempts}`,
						expiresAt: new Date(Date.now() + 60_000).toISOString()
					}
				}
			});
		}
	});
	await page.route('**/api/notices/2210001/discussions', async (route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		writes++;
		expect(route.request().postDataJSON().proof).toBe(`fresh-${attempts}`);
		await route.fulfill({
			status: 400,
			json: { success: false, message: '검증 토큰이 만료되었습니다. 다시 시도해주세요.' }
		});
	});
	await page.goto('/notices/2210001');
	await expect(async () => {
		await page.getByTestId('discussion-new-thread-button').click();
		await expect(page.getByTestId('discussion-new-thread-title')).toBeVisible({ timeout: 1000 });
	}).toPass();
	await page.getByTestId('discussion-new-thread-title').fill('보안 검증 토론');
	await page.getByTestId('discussion-new-thread-password').fill('password');
	await page.getByTestId('discussion-new-thread-content').fill('실패해도 유지할 의견입니다.');
	const submit = page.getByTestId('discussion-new-thread-submit');
	await submit.click();
	await expect(page.getByTestId('discussion-security-status')).toContainText('보안 상태');
	await expect(submit).toBeDisabled();
	await expect(page.getByTestId('discussion-new-thread-title')).toBeDisabled();
	await page
		.getByTestId('discussion-new-thread-modal')
		.locator('form')
		.evaluate((form) =>
			form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
		);
	expect(attempts).toBe(1);
	expect(writes).toBe(0);
	await page.screenshot({ path: '../_workspace/hashguard-v2/discussion-security-mobile-dark.png' });
	release();
	await expect(submit).toBeEnabled();
	await expect(page.locator('#thread-validation-error')).toBeVisible();
	await expect(page.getByTestId('discussion-new-thread-content')).toHaveValue(
		'실패해도 유지할 의견입니다.'
	);
	for (const count of [2, 3]) {
		await submit.click();
		await expect.poll(() => attempts).toBe(count);
		await expect(submit).toBeEnabled();
		await expect(page.locator('#thread-validation-error')).toBeVisible();
	}
	expect(writes).toBe(2);
});
