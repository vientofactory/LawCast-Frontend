import { error } from '@sveltejs/kit';
import { marked } from 'marked';
import { loadAdminNoticeList } from '$lib/server/announcements';
import type { PageServerLoad } from './$types';

/**
 * Notice body page: resolves the id against the single `GET /api/announcements`
 * list — adding a per-item backend route would break the read-only contract
 * (CRUD stays in Notion).
 *
 * The backend serves the Notion page body as Markdown (`notice.body`), which
 * is lexed here on the server so the client only receives plain token data.
 * The spread turns marked's TokensList (an array carrying an extra `links`
 * property) into a plain array that devalue can serialize.
 */
export const load: PageServerLoad = async ({ params, fetch }) => {
	const { items } = await loadAdminNoticeList(fetch);
	const notice = items.find((item) => item.id === params.id) ?? null;
	if (!notice) {
		throw error(404, '요청한 공지사항을 찾을 수 없습니다.');
	}
	const bodyTokens = notice.body ? [...marked.lexer(notice.body)] : [];
	return { notice, bodyTokens };
};
