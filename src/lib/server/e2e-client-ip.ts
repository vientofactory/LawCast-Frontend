import { env } from '$env/dynamic/private';

/**
 * Test-only hook: when `E2E_DISTINCT_CLIENT_IPS` is set, every SSR-issued GET
 * gets a distinct visitor IP instead of the caller's IP.
 *
 * One machine would otherwise be one per-visitor rate-limit bucket on the
 * backend (30 reads/60s), so a full run trips it mid-suite and the rate-limit
 * overlay blocks clicks — production never looks like this, because each
 * visitor brings its own IP. Writes stay out: proof-of-work and discussion
 * author ids are bound to the visitor IP. Null when the flag is off, so callers
 * fall back to lib/server/client-ip.ts.
 */
// RFC 5737 documentation ranges: real-looking, never routable.
const TEST_NET_BLOCKS = ['192.0.2', '198.51.100', '203.0.113'] as const;
const ADDRESSES_PER_BLOCK = 256;

let sequence = 0;

export function resolveE2eReadClientIp(request: Request): string | null {
	const flag = (env.E2E_DISTINCT_CLIENT_IPS ?? '').trim().toLowerCase();
	if (flag !== '1' && flag !== 'true') return null;
	if (request.method !== 'GET') return null;

	const index = sequence++;
	const block = TEST_NET_BLOCKS[index % TEST_NET_BLOCKS.length];
	const host = Math.floor(index / TEST_NET_BLOCKS.length) % ADDRESSES_PER_BLOCK;
	return `${block}.${host}`;
}
