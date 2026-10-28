import { createServer } from 'node:http';
let requests = [];
let failHome = false;
createServer((request, response) => {
	const url = new URL(request.url, 'http://127.0.0.1:4327');
	response.setHeader('content-type', 'application/json');
	if (url.pathname === '/control') {
		requests = [];
		failHome = url.searchParams.get('failHome') === '1';
		response.end('{}');
		return;
	}
	if (url.pathname === '/requests') {
		response.end(JSON.stringify(requests));
		return;
	}
	requests.push(url.pathname + url.search);
	let data;
	if (url.pathname === '/api/stats') {
		if (url.searchParams.get('view') === 'home') {
			if (failHome) {
				response.statusCode = 503;
				response.end('{}');
				return;
			}
			data = {
				archive: { count: 123 },
				cache: { lastUpdated: '2026-10-28T12:00:00Z' },
				changeTracking: { comparableEventTotal: 19 },
				aiSummaryEnabled: true
			};
		} else
			data = {
				webhooks: { total: 3, active: 2, inactive: 1 },
				cache: { size: 4, maxSize: 5000, isInitialized: true, lastUpdated: '2026-10-28T12:00:00Z' },
				archive: { count: 123 }
			};
	} else if (url.pathname === '/api/announcements/top') data = { item: null };
	else if (url.pathname === '/api/notices/recent') data = [];
	else if (url.pathname === '/api/notices/keywords')
		data = { items: [], updatedAt: null, sourceNoticeCount: 0 };
	else if (url.pathname === '/api/discussions/threads')
		data = { items: [], total: 0, page: 1, limit: 5 };
	else if (url.pathname === '/api/version') data = { version: 'fixture' };
	else {
		response.statusCode = 404;
		data = null;
	}
	response.end(JSON.stringify({ success: response.statusCode === 200, data }));
}).listen(4327, '127.0.0.1');
