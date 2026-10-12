/**
 * Cache policy for SSR HTML whose body varies per request.
 *
 * `/notices` and `/notices/semantic-search` embed a per-request random draw (the
 * example-query chips, see `pickExampleQueries`). SvelteKit emits no `Cache-Control`
 * for a dynamic page, so a shared cache — or a browser's heuristic freshness — could
 * keep one visitor's draw and replay it to everyone. The chips then look frozen,
 * which is exactly the symptom that made a deterministic draw look attractive; the
 * draw stays random instead, and the response declares itself uncacheable by shared
 * caches so no cache can pin one visitor's set.
 *
 * - `private`: shared caches (CDN, proxy) must not store or reuse the response.
 * - `no-cache`: the visitor's own browser may store it but must revalidate, so every
 *   navigation renders a fresh draw rather than replaying the previous one.
 *
 * Set from the page loader (`setHeaders`). The `handle` hook minifies HTML by
 * re-wrapping the resolved response with its own headers, so the directive survives
 * to the client in production builds as well as in `vite dev`.
 */
export const PER_REQUEST_HTML_CACHE_CONTROL = 'private, no-cache';
