import type {
	AdminNoticeCard,
	AdminNotice,
	DiscussionThreadCard,
	DiscussionThreadWithNotice,
	Notice,
	NoticeCard,
	NoticeChangeCard,
	RecentNoticeChangeItem
} from '$lib/types/api';

/**
 * Loader-side mappers for the SSR minimal-view contract: a route's load()
 * returns only the fields its UI renders, so unrelated pages never serialize
 * unused scalars, hashes or markdown bodies. The full API objects stay intact
 * in the client layer; only these card views are embedded in SSR data.
 */

/** Cap-1 notice view (home pinned chip, site-wide urgent banner). */
export function toAdminNoticeCard(notice: AdminNotice): AdminNoticeCard {
	return { id: notice.id, title: notice.title };
}

/** Notice row view shared by the home recent list and the /notices board. */
export function toNoticeCard(notice: Notice): NoticeCard {
	return {
		num: notice.num,
		subject: notice.subject,
		proposerCategory: notice.proposerCategory,
		committee: notice.committee,
		link: notice.link,
		isDone: notice.isDone,
		noticePeriod: notice.noticePeriod,
		aiSummary: notice.aiSummary,
		aiSummaryStatus: notice.aiSummaryStatus,
		lifecycleStatus: notice.lifecycleStatus,
		changeEventCount: notice.changeEventCount,
		attachments: notice.attachments
	};
}

/** Thread row view shared by /discussions and the home recent discussions. */
export function toDiscussionThreadCard(thread: DiscussionThreadWithNotice): DiscussionThreadCard {
	return {
		id: thread.id,
		noticeNum: thread.noticeNum,
		noticeSubject: thread.noticeSubject,
		title: thread.title,
		status: thread.status,
		authorNickname: thread.authorNickname,
		authorIpMasked: thread.authorIpMasked,
		commentCount: thread.commentCount,
		updatedAt: thread.updatedAt
	};
}

/** Change row view for the /notices/changes list (no hashes or diff details). */
export function toNoticeChangeCard(item: RecentNoticeChangeItem): NoticeChangeCard {
	return {
		id: item.id,
		noticeNum: item.noticeNum,
		subject: item.subject,
		detectedAt: item.detectedAt,
		eventType: item.eventType,
		source: item.source,
		eventHeight: item.eventHeight,
		changedFieldCount: item.changedFieldCount
	};
}
