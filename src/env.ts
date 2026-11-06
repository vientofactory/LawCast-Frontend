import { defineEnvVars } from '@sveltejs/kit/env';

// Optional deployment and fixture variables preserve their existing empty-string defaults.
export const variables = defineEnvVars({
	PUBLIC_GTM_CONTAINER_ID: { public: true, static: true, schema: (input) => input ?? '' },
	API_BASE_URL: { schema: (input) => input ?? '' },
	PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DISCORD_SERVER_URL: { public: true, schema: (input) => input ?? '' },
	PUBLIC_DISCORD_SERVER_ID: { public: true, schema: (input) => input ?? '' },
	E2E_NOTIFICATIONS: { schema: (input) => input ?? '' },
	PUBLIC_SEMANTIC_SEARCH_ENABLED: { public: true, schema: (input) => input ?? '' },
	E2E_FORCE_403: { schema: (input) => input ?? '' },
	PUBLIC_HASHGUARD_URL: { public: true, schema: (input) => input ?? '' },
	DIFFCHAIN_UI_MOCK: { schema: (input) => input ?? '' },
	DIFFCHAIN_UI_MOCK_NSM_DEGRADED: { schema: (input) => input ?? '' },
	E2E_DISTINCT_CLIENT_IPS: { schema: (input) => input ?? '' },
	E2E_FORCE_429_PATHS: { schema: (input) => input ?? '' }
});
