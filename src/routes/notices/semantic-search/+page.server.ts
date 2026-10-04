import { env } from '$env/dynamic/public';
import { redirect } from '@sveltejs/kit';
import { semanticSearch } from '$lib/api/client';
import { toLoadErrorPayload } from '$lib/server/load-error';
import {
	SEMANTIC_SEARCH_QUERY_PARAM,
	isSemanticSearchEnabled,
	parseSemanticSearchQuery,
	pickExampleQueries
} from '$lib/utils/semantic-search';
import type { SemanticSearchResponse } from '$lib/types/api';
import type { LoadErrorPayload } from '$lib/server/load-error';
import type { PageServerLoad } from './$types';

const DEFAULT_K = 10;
const SEARCH_FAILED_MESSAGE = '의미 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

export const load: PageServerLoad = async ({ url, fetch }) => {
	// Feature gate: the semantic search experience must not exist when disabled.
	if (!isSemanticSearchEnabled(env.PUBLIC_SEMANTIC_SEARCH_ENABLED)) {
		redirect(303, '/notices');
	}
	// The query lives in the URL (?search=...) so a search is shareable,
	// reloadable, and restored when the user comes back from a detail page.
	const query = parseSemanticSearchQuery(url.searchParams.get(SEMANTIC_SEARCH_QUERY_PARAM));
	// Drawn on the server so the first paint already shows the final chips; a
	// client-side draw would swap them after paint and flicker.
	const exampleQueries = pickExampleQueries();

	if (!query) {
		return { query, exampleQueries, search: null, loadError: null };
	}

	// The search itself is SSR: the results are in the HTML on a deep link or
	// reload, and SPA navigations to a new ?search= re-run this loader instead
	// of letting the browser call the search API. Failures (429 included) are
	// returned as data so a backend hiccup never breaks the whole page.
	try {
		const search: SemanticSearchResponse = await semanticSearch({ query, k: DEFAULT_K }, fetch);
		return { query, exampleQueries, search, loadError: null };
	} catch (err) {
		console.error('Failed to run semantic search:', err);
		const loadError: LoadErrorPayload = toLoadErrorPayload(err, SEARCH_FAILED_MESSAGE);
		return { query, exampleQueries, search: null, loadError };
	}
};
