import { env } from '$env/dynamic/public';
import { redirect } from '@sveltejs/kit';
import { isSemanticSearchEnabled } from '$lib/utils/semantic-search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Feature gate: the semantic search experience must not exist when disabled.
	if (!isSemanticSearchEnabled(env.PUBLIC_SEMANTIC_SEARCH_ENABLED)) {
		redirect(303, '/notices');
	}
	return {};
};
