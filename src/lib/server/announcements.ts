import { apiClient } from '$lib/api/client';
import { isDiffchainUiMockEnabled, getMockAdminNotices } from '$lib/server/diffchain-ui-mock';
import { toAdminNoticeCard } from '$lib/server/ssr-cards';
import type { AdminNoticeListResponse, AdminNoticeTopResponse } from '$lib/types/api';

/**
 * Upper bound for how long SSR waits for the Notion-backed admin notice API.
 * A healthy backend answers from its in-memory cache in milliseconds, while a
 * cold Notion refresh takes seconds (sequential block fetches plus request
 * pacing), so this only bites when the backend is slow or unreachable — and
 * then the page must fail fast instead of holding the SSR response open.
 */
const ADMIN_NOTICE_SSR_TIMEOUT_MS = 2500;

/**
 * Races a Notion-backed fetch against the SSR timer. The losing fetch keeps
 * running in the background (there is no abort signal to hand it), but the
 * SSR response no longer waits for it. Real backend errors still propagate
 * immediately — also a fast failure, never a hang.
 */
function raceWithTimeout<T>(task: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() =>
				reject(
					new Error(
						`admin notice SSR fetch exceeded ${ADMIN_NOTICE_SSR_TIMEOUT_MS}ms; failing fast instead of holding the response`
					)
				),
			ADMIN_NOTICE_SSR_TIMEOUT_MS
		);
	});
	return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Single implementation of admin notice list loading: the list and detail
 * routes share one mock branch and one `GET /api/announcements` call.
 * Per-route duplication is how the mock branch went missing once already.
 * Bounded by the SSR timer — a slow or failing Notion fetch rejects within
 * `ADMIN_NOTICE_SSR_TIMEOUT_MS` so the route can answer 503/429 at once.
 */
export async function loadAdminNoticeList(
	fetch?: Parameters<typeof apiClient.getAdminNotices>[0]
): Promise<AdminNoticeListResponse> {
	if (isDiffchainUiMockEnabled()) {
		return getMockAdminNotices();
	}
	return raceWithTimeout(apiClient.getAdminNotices(fetch));
}

/**
 * Single implementation of the one-notice loaders (home pinned chip,
 * site-wide urgent banner): the mock branch mirrors the backend selection of
 * `GET /api/announcements/top` (top display-order, or first urgent with
 * `urgent: true`) so global SSR pages never fetch or serialize the full list.
 */
export async function loadTopAdminNotice(
	options: { urgent?: boolean } = {},
	fetch?: Parameters<typeof apiClient.getTopAdminNotice>[1]
): Promise<AdminNoticeTopResponse> {
	if (isDiffchainUiMockEnabled()) {
		const { items } = getMockAdminNotices();
		const top = (options.urgent ? items.find((notice) => notice.urgent) : items[0]) ?? null;
		// Same cap-1 view as the backend route: id + title only.
		return { item: top ? toAdminNoticeCard(top) : null };
	}
	try {
		return await raceWithTimeout(apiClient.getTopAdminNotice(options, fetch));
	} catch {
		// The chip and banner are decorative: any slow or failing Notion
		// fetch hides them instead of delaying every page (the layout loader
		// awaits this on all routes).
		return { item: null };
	}
}
