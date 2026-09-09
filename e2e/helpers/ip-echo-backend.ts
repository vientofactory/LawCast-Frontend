import { createServer } from 'node:http';

/**
 * Minimal backend stand-in that records the client-IP headers it receives on
 * each request. Used to prove that SSR-issued API requests actually carry the
 * forwarded visitor IP — a real regression happened here silently because
 * SvelteKit ignores a separate fetch() init when the first argument is a
 * Request object.
 *
 * Runs standalone (Playwright webServer entry) and exposes the recorded
 * requests via GET /__records so tests can assert on them.
 */
export interface RecordedRequest {
	url: string;
	ipHeaders: Record<string, string | undefined>;
}

const TRACKED_HEADERS = [
	'x-lawcast-client-ip',
	'cf-connecting-ip',
	'x-forwarded-for',
	'x-real-ip'
] as const;

const PORT = Number(process.env.ECHO_PORT ?? 3999);

const record: RecordedRequest[] = [];

function echoPayload(url: string): unknown {
	// /api/notices/recent yields a bare array; other list endpoints a page object.
	if (url.startsWith('/api/notices/recent')) {
		return [];
	}
	return {
		items: [],
		page: 1,
		limit: 10,
		total: 0,
		totalPages: 1,
		summary: {
			comparableEventTotal: 0,
			comparableNoticeCount: 0
		}
	};
}

createServer((req, res) => {
	const url = req.url ?? '';

	if (url.startsWith('/__records')) {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify(record));
		return;
	}

	const ipHeaders: Record<string, string | undefined> = {};
	for (const name of TRACKED_HEADERS) {
		const value = req.headers[name];
		if (typeof value === 'string') {
			ipHeaders[name] = value;
		}
	}
	record.push({ url, ipHeaders });

	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(JSON.stringify({ success: true, data: echoPayload(url) }));
}).listen(PORT, () => {
	console.log(`ip-echo-backend listening on ${PORT}`);
});
