import { expect, test } from '@playwright/test';
import type { RecordedRequest } from './helpers/ip-echo-backend';

/**
 * Regression tests for client-IP forwarding on SSR-issued API requests.
 *
 * A real bug shipped here silently: SvelteKit's handleFetch normalization
 * ignores a separate fetch() init when the first argument is a Request
 * object, so the sanitized x-lawcast-client-ip header never reached the
 * backend and every user shared the edge IP's rate-limit bucket.
 *
 * This suite boots the dev server with API_BASE_URL pointed at the echo
 * backend (which records received IP headers, see helpers/ip-echo-backend.ts)
 * and asserts what actually arrived on the wire.
 *
 * Run with: npm run test:e2e:ip-forwarding
 */
const enabled = process.env.E2E_IP_ECHO === '1';

const ECHO_BASE = 'http://127.0.0.1:3999';
const DEV_SERVER = 'http://127.0.0.1:5223';

async function fetchRecords(): Promise<RecordedRequest[]> {
	const response = await fetch(`${ECHO_BASE}/__records`);
	expect(response.ok).toBe(true);
	return (await response.json()) as RecordedRequest[];
}

/**
 * Polls the echo backend until a NEW request matching `urlSubstring` shows up
 * (one recorded after `baselineCount`), so tests never match each other's
 * records — several tests hit the same endpoint.
 */
async function findRecorded(
	urlSubstring: string,
	baselineCount: number,
	timeoutMs = 5000
): Promise<RecordedRequest> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const records = await fetchRecords();
		const match = records
			.slice(baselineCount)
			.find((entry) => entry.url.includes(urlSubstring));
		if (match) return match;
		if (Date.now() > deadline) {
			throw new Error(`echo backend never received a request matching ${urlSubstring}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
}

async function currentRecordCount(): Promise<number> {
	return (await fetchRecords()).length;
}

test.describe('SSR client-IP forwarding', () => {
	test.skip(!enabled, 'Set E2E_IP_ECHO=1 to run these tests (npm run test:e2e:ip-forwarding).');

	test('SSR page load forwards the visitor IP from cf-connecting-ip', async ({ request }) => {
		const baseline = await currentRecordCount();
		const response = await request.get(`${DEV_SERVER}/notices`, {
			headers: { 'cf-connecting-ip': '198.51.100.23' },
			maxRedirects: 0
		});
		expect(response.status()).toBe(200);

		const record = await findRecorded('/api/notices/archive', baseline);
		expect(record.ipHeaders['x-lawcast-client-ip']).toBe('198.51.100.23');
	});

	test('SSR page load forwards the visitor IP from x-forwarded-for (leftmost)', async ({
		request
	}) => {
		const baseline = await currentRecordCount();
		const response = await request.get(`${DEV_SERVER}/notices`, {
			headers: { 'x-forwarded-for': '198.51.100.77, 10.0.0.1' },
			maxRedirects: 0
		});
		expect(response.status()).toBe(200);

		const record = await findRecorded('/api/notices/archive', baseline);
		expect(record.ipHeaders['x-lawcast-client-ip']).toBe('198.51.100.77');
	});

	test('client-side proxy forwards the visitor IP', async ({ request }) => {
		const baseline = await currentRecordCount();
		const response = await request.get(`${DEV_SERVER}/api/notices/recent`, {
			headers: { 'cf-connecting-ip': '203.0.113.55' }
		});
		expect(response.status()).toBe(200);

		const record = await findRecorded('/api/notices/recent', baseline);
		expect(record.ipHeaders['x-lawcast-client-ip']).toBe('203.0.113.55');
	});

	test('spoofed x-lawcast-client-ip from the visitor is stripped before forwarding', async ({
		request
	}) => {
		const baseline = await currentRecordCount();
		const response = await request.get(`${DEV_SERVER}/api/notices/recent`, {
			headers: {
				'cf-connecting-ip': '203.0.113.55',
				'x-lawcast-client-ip': '6.6.6.6'
			}
		});
		expect(response.status()).toBe(200);

		const record = await findRecorded('/api/notices/recent', baseline);
		expect(record.ipHeaders['x-lawcast-client-ip']).toBe('203.0.113.55');
	});
});
