import { createServer, request } from 'node:http';

// Delay the actual HTTP response: browser routing cannot pause worker-owned fetches.
let state = { cssDelay: 0, cssFailure: false };
let requests = [];
createServer(async (incoming, outgoing) => {
	const url = new URL(incoming.url, 'http://127.0.0.1:4187');
	if (url.pathname === '/__pwa-test/state') {
		if (incoming.method === 'POST') {
			let body = '';
			for await (const chunk of incoming) body += chunk;
			state = { cssDelay: 0, cssFailure: false, ...JSON.parse(body) };
			requests = [];
		}
		outgoing.writeHead(200, { 'Content-Type': 'application/json' });
		outgoing.end(JSON.stringify({ state, requests }));
		return;
	}
	const style = url.pathname.startsWith('/_app/immutable/assets/') && url.pathname.endsWith('.css');
	const record = { path: incoming.url, style, start: Date.now(), finish: null };
	requests.push(record);
	outgoing.on('finish', () => {
		record.finish = Date.now();
	});
	if (url.pathname === '/' && url.searchParams.get('pwa-test') === 'redirect') {
		outgoing.writeHead(302, { Location: '/webhook' });
		outgoing.end();
		return;
	}
	const forward = () => {
		if (style && state.cssFailure) {
			outgoing.writeHead(503, { 'Content-Type': 'text/plain' });
			outgoing.end('Stylesheet temporarily unavailable');
			return;
		}
		const upstream = request(
			{
				hostname: '127.0.0.1',
				port: 4185,
				path: incoming.url,
				method: incoming.method,
				headers: incoming.headers
			},
			(response) => {
				const status =
					url.pathname === '/' && url.searchParams.get('pwa-test') === 'status'
						? 503
						: response.statusCode;
				outgoing.writeHead(status, {
					...response.headers,
					'X-Pwa-Test-Target': incoming.url,
					'Content-Security-Policy': "frame-ancestors 'self'"
				});
				response.pipe(outgoing);
			}
		);
		upstream.on('error', () => {
			outgoing.writeHead(502);
			outgoing.end();
		});
		incoming.pipe(upstream);
	};
	const delay = style
		? state.cssDelay
		: url.pathname === '/' && url.searchParams.get('pwa-test') === 'slow'
			? 17000
			: 0;
	if (delay) {
		const timer = setTimeout(forward, delay);
		outgoing.on('close', () => clearTimeout(timer));
	} else {
		forward();
	}
}).listen(4187, '127.0.0.1');
