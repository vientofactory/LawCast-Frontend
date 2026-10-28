import { createServer, request } from 'node:http';

// Delay the actual HTTP response: browser routing cannot pause worker-owned fetches.
createServer((incoming, outgoing) => {
	const forward = () => {
		const upstream = request(
			{
				hostname: '127.0.0.1',
				port: 4185,
				path: incoming.url,
				method: incoming.method,
				headers: incoming.headers
			},
			(response) => {
				outgoing.writeHead(response.statusCode, response.headers);
				response.pipe(outgoing);
			}
		);
		upstream.on('error', () => {
			outgoing.writeHead(502);
			outgoing.end();
		});
		incoming.pipe(upstream);
	};
	const url = new URL(incoming.url, 'http://127.0.0.1:4187');
	if (url.pathname === '/' && url.searchParams.get('pwa-test') === 'slow') {
		const timer = setTimeout(forward, 17000);
		outgoing.on('close', () => clearTimeout(timer));
	} else {
		forward();
	}
}).listen(4187, '127.0.0.1');
