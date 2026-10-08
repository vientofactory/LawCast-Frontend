import { apiClient } from '$lib/api/client';
import { isDiffchainUiMockEnabled, getMockAdminNotices } from '$lib/server/diffchain-ui-mock';
import { toAdminNoticeCard } from '$lib/server/ssr-cards';
import type { AdminNoticeListResponse, AdminNoticeTopResponse } from '$lib/types/api';

/**
 * Single implementation of admin notice list loading: the list and detail
 * routes share one mock branch and one `GET /api/announcements` call.
 * Per-route duplication is how the mock branch went missing once already.
 */
export async function loadAdminNoticeList(
	fetch?: Parameters<typeof apiClient.getAdminNotices>[0]
): Promise<AdminNoticeListResponse> {
	if (isDiffchainUiMockEnabled()) {
		return getMockAdminNotices();
	}
	return apiClient.getAdminNotices(fetch);
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
	return apiClient.getTopAdminNotice(options, fetch);
}
