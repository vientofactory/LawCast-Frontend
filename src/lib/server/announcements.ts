import { apiClient } from '$lib/api/client';
import { isDiffchainUiMockEnabled, getMockAdminNotices } from '$lib/server/diffchain-ui-mock';
import type { AdminNoticeListResponse } from '$lib/types/api';

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
