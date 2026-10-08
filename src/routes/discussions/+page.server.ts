import { apiClient } from '$lib/api/client';
import { DiscussionThreadStatus } from '$lib/types/api';
import {
	isDiffchainUiMockEnabled,
	getMockAllDiscussionThreads
} from '$lib/server/diffchain-ui-mock';
import { toLoadErrorPayload } from '$lib/server/load-error';
import { toDiscussionThreadCard } from '$lib/server/ssr-cards';
import type {
	DiscussionThreadCardListResponse,
	DiscussionThreadWithNoticeListResponse
} from '$lib/types/api';
import type { PageServerLoad } from './$types';

const DEFAULT_PAGE_SIZE = 20;

/** The list renders DiscussionThreadCard row fields only; isLocked/createdAt stay off SSR data. */
function toCardResponse(
	threads: DiscussionThreadWithNoticeListResponse
): DiscussionThreadCardListResponse {
	return { ...threads, items: threads.items.map(toDiscussionThreadCard) };
}

function parseStatus(raw: string | null): DiscussionThreadStatus | undefined {
	if (raw === DiscussionThreadStatus.OPEN) {
		return DiscussionThreadStatus.OPEN;
	}
	if (raw === DiscussionThreadStatus.CLOSED) {
		return DiscussionThreadStatus.CLOSED;
	}
	if (raw === 'all') {
		return undefined;
	}
	return DiscussionThreadStatus.OPEN;
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const requestedPage = Number(url.searchParams.get('page') || '1');
	const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
	const status = parseStatus(url.searchParams.get('status'));

	if (isDiffchainUiMockEnabled()) {
		return {
			threads: toCardResponse(getMockAllDiscussionThreads()),
			status
		};
	}

	try {
		const threads = await apiClient.getAllDiscussionThreads(
			{ page, limit: DEFAULT_PAGE_SIZE, status },
			fetch
		);
		return { threads: toCardResponse(threads), status };
	} catch (err) {
		console.error('Failed to load all discussion threads:', err);
		const loadError = toLoadErrorPayload(err, '토론 목록을 불러오는 중 오류가 발생했습니다.');
		return {
			threads: { items: [], total: 0, page, limit: DEFAULT_PAGE_SIZE },
			status,
			loadError
		};
	}
};
