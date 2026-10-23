import { createServer } from 'node:http';

let requests = [];
let active = 0;
let maxActive = 0;
let failPage = null;
let shortPage = null;
let total = 6501;

createServer(async (request, response) => {
	const url = new URL(request.url, 'http://localhost');
	response.setHeader('Content-Type', 'application/json');
	if (url.pathname === '/control') {
		total = url.searchParams.has('total') ? Number(url.searchParams.get('total')) : 6501;
		failPage = Number(url.searchParams.get('fail')) || null;
		shortPage = Number(url.searchParams.get('short')) || null;
		requests = [];
		maxActive = 0;
		response.end('{}');
		return;
	}
	if (url.pathname === '/stats') {
		response.end(JSON.stringify({ requests, maxActive }));
		return;
	}
	const page = Number(url.searchParams.get('page'));
	const limit = Number(url.searchParams.get('limit'));
	requests.push({
		page,
		limit,
		sortOrder: url.searchParams.get('sortOrder'),
		headers: request.headers
	});
	active++;
	maxActive = Math.max(maxActive, active);
	await new Promise((resolve) => setTimeout(resolve, 10));
	active--;
	if (page === failPage) {
		response.statusCode = 503;
		response.end('{}');
		return;
	}
	const length = Math.max(0, Math.min(limit, total - (page - 1) * limit));
	const items = Array.from({ length }, (_, index) => ({
		num: 2200001 + (page - 1) * limit + index,
		archiveStartedAt: '2026-09-01T00:00:00+09:00',
		lastUpdatedAt: index === 0 ? '2026-10-23T23:30:00+09:00' : 'invalid-date'
	}));
	if (page === shortPage) items.pop();
	const data = { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
	// Exercise both envelope shapes accepted by the frontend.
	response.end(JSON.stringify(page % 2 ? { data } : data));
}).listen(4319, '127.0.0.1');
