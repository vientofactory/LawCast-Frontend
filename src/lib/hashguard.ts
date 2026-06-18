import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { HashGuardClient, initHashGuardWasm } from 'hashguard-client';

const HASHGUARD_URL = env.PUBLIC_HASHGUARD_URL || 'https://hashguard.viento.me';

const hashGuardClient = new HashGuardClient({
	baseUrl: HASHGUARD_URL
});

let wasmInitPromise: Promise<boolean> | null = null;

export function getHashGuardClient(): HashGuardClient {
	return hashGuardClient;
}

export function warmupHashGuardWasm(): Promise<boolean> {
	if (!browser) {
		return Promise.resolve(false);
	}

	if (!wasmInitPromise) {
		wasmInitPromise = initHashGuardWasm().catch(() => false);
	}

	return wasmInitPromise;
}
