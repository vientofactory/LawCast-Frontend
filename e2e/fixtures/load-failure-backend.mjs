import { createServer } from 'node:http';
let mode = 'server';
let requests = 0;
createServer(async (request, response) => {
	const url = new URL(request.url, 'http://127.0.0.1:4331');
	if (url.pathname === '/control') {
		mode = url.searchParams.get('mode') || 'server';
		requests = 0;
		response.setHeader('cache-control', 'no-store');
		response.end(JSON.stringify({ mode }));
		return;
	}
	if (url.pathname === '/requests') {
		response.end(JSON.stringify({ requests, mode }));
		return;
	}
	requests++;
	const requestMode = mode;
	response.setHeader('cache-control', 'no-store');
	response.setHeader('x-fixture-mode', requestMode);
	if (url.pathname.endsWith('/semantic-search/health')) {
		response.setHeader('content-type', 'application/json');
		response.end(
			JSON.stringify({
				success: true,
				data: { status: 'ready', model: 'fixture', indexedChunks: 1 }
			})
		);
		return;
	}
	if (requestMode === 'partial' || requestMode === 'partial-network') {
		response.setHeader('content-type', 'application/json');
		if (url.pathname.endsWith('/detail')) {
			response.end(
				JSON.stringify({
					success: true,
					data: {
						notice: {
							num: 2210001,
							subject: '실패 구분 테스트 법률안',
							proposerCategory: '의원',
							committee: '',
							link: '',
							attachments: { pdfFile: '', hwpFile: '' }
						},
						originalContent: {
							title: '실패 구분 테스트 법률안',
							proposalReason: '테스트 원문',
							contentId: ''
						},
						archiveMetadata: {
							archivedAt: '2026-11-06T00:00:00Z',
							sourceHtmlSha256: '',
							sourceHtmlSize: 0,
							integrity: {},
							http: {}
						},
						screenshotMeta: { hasScreenshot: false },
						revision: {
							headRev: 1,
							resolvedRev: 1,
							requestedRev: null,
							hasDiffchain: false,
							isHistorical: false
						}
					}
				})
			);
			return;
		}
		if (url.pathname.endsWith('/changes')) {
			response.end(
				JSON.stringify({ success: true, data: { noticeNum: 2210001, items: [], count: 0 } })
			);
			return;
		}
		if (requestMode === 'partial-network') {
			request.socket.destroy();
			return;
		}
		response.statusCode = 503;
		response.end(JSON.stringify({ message: 'Upstream failure', retryAfter: 60 }));
		return;
	}
	if (requestMode === 'network') {
		request.socket.destroy();
		return;
	}
	if (requestMode === 'slow') await new Promise((resolve) => setTimeout(resolve, 60000));
	const status =
		{
			server: 503,
			internal: 500,
			gateway: 502,
			timeout: 504,
			unauthorized: 401,
			forbidden: 403,
			invalid: 400,
			missing: 404,
			rate: 429,
			'rate-html': 429,
			'rate-json': 429
		}[requestMode] || 200;
	response.statusCode = status;
	response.setHeader('retry-after', '2');
	response.setHeader(
		'content-type',
		requestMode === 'rate-html' || requestMode === 'html' ? 'text/html' : 'application/json'
	);
	if (requestMode === 'rate-json' || requestMode === 'bad-json') {
		response.end('{invalid');
		return;
	}
	if (requestMode === 'rate-html' || requestMode === 'html') {
		response.end('<html>upstream unavailable</html>');
		return;
	}
	if (status !== 200) {
		response.end(JSON.stringify({ message: 'Upstream failure', retryAfter: 90 }));
		return;
	}
	if (requestMode === 'false-envelope') {
		response.end(
			JSON.stringify({ success: false, message: '요청이 너무 많습니다', retryAfter: 90 })
		);
		return;
	}
	const data = url.pathname.includes('/archive')
		? { items: [], total: 0, page: 1, limit: 20, totalPages: 0 }
		: {};
	response.end(JSON.stringify({ success: true, data }));
}).listen(4331, '127.0.0.1');
