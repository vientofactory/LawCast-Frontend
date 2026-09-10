import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
