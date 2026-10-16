import * as staticPublicEnv from '$env/static/public'; /**
 * Google Tag Manager helpers.
 * The container ID is baked at build time from `PUBLIC_GTM_CONTAINER_ID`.
 * A namespace import is used (instead of a named import) so builds and
 * type checks keep working when the variable is unset — e.g. local dev
 * without a `.env` entry — in which case the ID is empty and all GTM
 * loading and page view pushes are skipped. The real container ID lives
 * only in deployment environments, never in this repository.
 */
const { PUBLIC_GTM_CONTAINER_ID } = staticPublicEnv as Record<string, string | undefined>;
export const GTM_CONTAINER_ID = PUBLIC_GTM_CONTAINER_ID || '';

export interface GtmPageView {
	event: 'page_view' | 'virtual_pageview';
	page_path: string;
	page_location: string;
	page_title: string;
}

/**
 * Push a page view event to the GTM dataLayer. Drops the event when the
 * visitor has not accepted tracking, so pre-consent navigations never
 * sit queued in the dataLayer, and when no container ID is configured.
 * Also safe during SSR or when GTM is blocked (ad blocker).
 */
export function pushGtmPageView(path: string): void {
	if (typeof window === 'undefined' || !GTM_CONTAINER_ID) return;
	try {
		if (window.localStorage.getItem('lawcast-cookie-consent') !== 'accepted') return;
	} catch {
		return;
	}
	const dataLayer = window.dataLayer;
	if (!Array.isArray(dataLayer)) return;
	const page_path = path || '/';
	dataLayer.push({
		event: 'virtual_pageview',
		page_path,
		page_location: window.location.href,
		page_title: document.title
	} satisfies GtmPageView);
}
