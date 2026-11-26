import { expect, test } from '@playwright/test';

for (const encoding of ['gzip', 'br', 'identity']) {
	for (const status of [200, 429]) {
		test(`streams ${encoding} proxy responses with status ${status} without stale wire metadata`, async ({
			request
		}) => {
			const response = await request.get(`/api/proxy-encoding/${encoding}?status=${status}`);
			expect(response.status()).toBe(status);
			expect(response.headers()['content-type']).toContain('application/json');
			expect(response.headers()['cache-control']).toBe(
				status === 429 ? 'private, no-store' : 'no-store'
			);
			if (status === 429) expect(response.headers()['retry-after']).toBe('3');
			expect(await response.json()).toEqual({
				success: status === 200,
				data: { text: '압축 응답 검증', encoding }
			});
		});
	}
}
