import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	if (env.E2E_FORCE_403 === '1') {
		throw error(403, 'Cloudflare challenge simulation');
	}
	return {};
};
