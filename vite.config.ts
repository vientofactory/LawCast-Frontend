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
			protocol: 'wss',
			clientPort: 443
		}
	}
});
