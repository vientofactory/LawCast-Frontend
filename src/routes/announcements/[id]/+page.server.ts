import { error } from '@sveltejs/kit';
import { loadAdminNoticeList } from '$lib/server/announcements';
import { lexNoticeBody } from '$lib/server/notice-body';
import type { PageServerLoad } from './$types';

/**
 * Notice body page: resolves the id against the single `GET /api/announcements`
 * list — adding a per-item backend route would break the read-only contract
 * (CRUD stays in Notion).
 *
 * The backend serves the Notion page body as Markdown (`notice.body`), which
 * is lexed here on the server so the client only receives plain token data.
 * `lexNoticeBody` wraps marked's lexer: it lifts Notion toggle blocks
 * (`<details>/<summary>` per notion-to-md) into toggle tokens the renderer
 * turns into clickable disclosures, and returns a plain array (no TokensList
 * `links` property) that devalue can serialize.
 */
export const load: PageServerLoad = async ({ params, fetch }) => {
	const { items } = await loadAdminNoticeList(fetch);
	const notice = items.find((item) => item.id === params.id) ?? null;
	if (!notice) {
		throw error(404, '요청한 공지사항을 찾을 수 없습니다.');
	}
	const bodyTokens = notice.body ? lexNoticeBody(notice.body) : [];
	return { notice, bodyTokens };
};
