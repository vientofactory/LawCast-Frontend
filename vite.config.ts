import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function resolveBuildTimeVersions(): { appVersion: string; backendVersion: string } {
	const envAppVersion = process.env.APP_VERSION?.trim();
	if (envAppVersion) {
		return {
			appVersion: envAppVersion,
			backendVersion: process.env.BACKEND_VERSION?.trim() || 'unknown'
		};
	}

	try {
		const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
			version?: string;
		};
		if (pkg.version) {
			return {
				appVersion: pkg.version,
				backendVersion: process.env.BACKEND_VERSION?.trim() || 'unknown'
			};
		}
	} catch {
		/* empty */
	}

	return {
		appVersion: 'unknown',
		backendVersion: process.env.BACKEND_VERSION?.trim() || 'unknown'
	};
}

const { appVersion, backendVersion } = resolveBuildTimeVersions();

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(appVersion),
		__BACKEND_VERSION__: JSON.stringify(backendVersion)
	},
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		noExternal: ['cookie']
	},
	// Sharing the development server over a network (e.g., ngrok)
	server: {
		host: true,
		allowedHosts: true,
		hmr: {
			// Use wss for remote/ngrok, ws for local
			protocol: process.env.REMOTE_DEV ? 'wss' : 'ws',
			clientPort: process.env.REMOTE_DEV ? 443 : undefined
		}
	}
});
