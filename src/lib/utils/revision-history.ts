import type { NoticeChangeEventItem, NoticeChangeTimelineResponse } from '$lib/types/api';

export const REVISION_HISTORY_PAGE_SIZE = 20;

export function mergeRevisionHistory(
	existing: NoticeChangeEventItem[],
	incoming: NoticeChangeEventItem[]
): NoticeChangeEventItem[] {
	return [
		...new Map([...existing, ...incoming].map((item) => [item.eventHeight, item])).values()
	].sort((a, b) => b.eventHeight - a.eventHeight);
}

export function revisionHistoryCursor(page: NoticeChangeTimelineResponse) {
	const oldest = page.items.length ? Math.min(...page.items.map((item) => item.eventHeight)) : null;
	const hasMore = page.hasMore ?? (oldest !== null && oldest > 1);
	return { hasMore, nextBeforeHeight: hasMore ? (page.nextBeforeHeight ?? oldest) : null };
}

export function validateOlderRevisionPage(
	page: NoticeChangeTimelineResponse,
	noticeNum: number,
	beforeHeight: number
) {
	const cursor = revisionHistoryCursor(page);
	const oldest = page.items.length ? Math.min(...page.items.map((item) => item.eventHeight)) : null;
	if (
		page.noticeNum !== noticeNum ||
		page.items.some(
			(item) =>
				item.noticeNum !== noticeNum ||
				!Number.isSafeInteger(item.eventHeight) ||
				item.eventHeight < 1 ||
				item.eventHeight >= beforeHeight
		) ||
		(cursor.hasMore && (oldest === null || cursor.nextBeforeHeight !== oldest))
	) {
		throw new Error('The revision page did not advance its notice-scoped cursor.');
	}
	return cursor;
}
