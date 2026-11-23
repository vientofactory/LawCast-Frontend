import { createServer } from 'node:http';

let requests = [];
let attempt = 0;
let archiveReads = 0;
const total = 22740;

createServer((request, response) => {
	const url = new URL(request.url, 'http://localhost');
	response.setHeader('Content-Type', 'application/json');
	if (url.pathname === '/stats') {
		response.end(JSON.stringify({ requests, archiveReads }));
		return;
	}
	requests.push({ path: url.pathname, headers: request.headers });
	if (url.pathname === '/api/notices/archive') {
		// Interactive reads retain their own quota; sitemap generation must never use it.
		archiveReads++;
		response.statusCode = archiveReads > 30 ? 429 : 200;
		response.end('{}');
		return;
	}
	if (url.pathname !== '/api/sitemap/notices') {
		response.statusCode = 404;
		response.end('{}');
		return;
	}
	attempt++;
	if (attempt === 1) {
		response.statusCode = 503;
		response.end('{}');
		return;
	}
	response.end(
		JSON.stringify({
			generatedAt: new Date().toISOString(),
			total,
			items: Array.from({ length: attempt === 2 ? total - 1 : total }, (_, index) => ({
				num: 2200001 + index,
				archiveStartedAt: index === 0 ? '2026-10-23T14:30:00.000Z' : null
			}))
		})
	);
}).listen(4319, '127.0.0.1');
