import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Precompress static assets for better performance
			precompress: true
		}),
		env: {
			// Expose environment variables to client-side code
			publicPrefix: 'PUBLIC_'
		}
	}
};

export default config;
