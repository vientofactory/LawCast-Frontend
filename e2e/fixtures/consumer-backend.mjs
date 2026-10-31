import { createServer } from 'node:http';
let requests = [];
let failHome = false;
let failChanges = false;
let historyCount = 0;
let historyWindow = false;
let noFields = false;
createServer((request, response) => {
	const url = new URL(request.url, 'http://127.0.0.1:4327');
	response.setHeader('content-type', 'application/json');
	if (url.pathname === '/control') {
		requests = [];
		failHome = url.searchParams.get('failHome') === '1';
		failChanges = url.searchParams.get('failChanges') === '1';
		historyCount = Number(url.searchParams.get('historyCount') || 0);
		historyWindow = url.searchParams.get('historyWindow') === '1';
		noFields = url.searchParams.get('noFields') === '1';
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
	} else if (url.pathname === '/api/notices/2210001/detail') {
		data = {
			notice: {
				num: 2210001,
				subject: '변경 기록 테스트 법률안',
				proposerCategory: '의원',
				committee: '',
				link: 'https://example.com/bill',
				attachments: {}
			},
			originalContent: {
				title: '변경 기록 테스트 법률안',
				proposalReason: '제안이유 원문',
				contentId: ''
			},
			archiveMetadata: {
				archivedAt: '2026-10-31T12:00:00Z',
				sourceHtmlSha256: '',
				sourceHtmlSize: 0,
				integrity: {},
				http: {}
			},
			screenshotMeta: { hasScreenshot: false },
			revision: {
				headRev: historyWindow ? 5 : historyCount,
				resolvedRev: historyWindow ? 5 : historyCount,
				requestedRev: null,
				hasDiffchain: historyCount > 0,
				isHistorical: false
			}
		};
	} else if (url.pathname === '/api/notices/2210001/changes') {
		if (failChanges) {
			response.statusCode = 503;
			response.end(JSON.stringify({ success: false, message: '변경 기록 조회 실패' }));
			return;
		}
		const candidates = Array.from({ length: historyCount }, (_, i) => ({
			id: i + 1,
			noticeNum: 2210001,
			eventHeight: historyWindow ? i + 4 : i + 1,
			detectedAt: '2026-10-31T12:00:00Z',
			eventType: 'updated',
			source: null,
			eventHash: `fixture-${i}`,
			prevEventHash: null,
			hashAlgo: 'sha256',
			canonVersion: 1,
			changedFieldCount: 0,
			diffSummary: null,
			details: noFields
				? []
				: [
						{
							id: i + 1,
							fieldPath: 'subject',
							changeType: 'modified',
							beforeValue: '변경 기록 테스트 법률안',
							afterValue: '변경 기록 테스트 법률안',
							beforeHash: null,
							afterHash: null
						}
					]
		}));
		const beforeHeight = Number(url.searchParams.get('beforeHeight') || Infinity);
		const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100);
		const available = candidates
			.filter((item) => item.eventHeight < beforeHeight)
			.sort((a, b) => b.eventHeight - a.eventHeight);
		const items = available.slice(0, limit);
		const hasMore = available.length > limit;
		data = {
			noticeNum: 2210001,
			count: items.length,
			items,
			hasMore,
			nextBeforeHeight: hasMore ? items.at(-1).eventHeight : null
		};
	} else if (url.pathname === '/api/notices/2210001/discussions') {
		data = { items: [], total: 0, page: 1, limit: 20 };
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
