import { env } from '$env/dynamic/public';
import { redirect } from '@sveltejs/kit';
import {
	SEMANTIC_SEARCH_QUERY_PARAM,
	isSemanticSearchEnabled,
	parseSemanticSearchQuery
} from '$lib/utils/semantic-search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Feature gate: the semantic search experience must not exist when disabled.
	if (!isSemanticSearchEnabled(env.PUBLIC_SEMANTIC_SEARCH_ENABLED)) {
		redirect(303, '/notices');
	}
	// The query lives in the URL (?search=...) so a search is shareable,
	// reloadable, and restored when the user comes back from a detail page.
	return { query: parseSemanticSearchQuery(url.searchParams.get(SEMANTIC_SEARCH_QUERY_PARAM)) };
};
