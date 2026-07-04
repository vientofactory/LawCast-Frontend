import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockNoticeChanges,
	getMockNoticeDetail
} from '$lib/server/diffchain-ui-mock';

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const noticeNum = Number(params.num);

	if (!Number.isInteger(noticeNum) || noticeNum <= 0) {
		throw error(400, '유효하지 않은 법률안 번호입니다.');
	}

	try {
		const revRaw = url.searchParams.get('rev');
		const rev = revRaw ? Number.parseInt(revRaw, 10) : undefined;
		const resolvedRev = Number.isInteger(rev) && (rev as number) > 0 ? rev : undefined;

		if (isDiffchainUiMockEnabled()) {
			return {
				detail: getMockNoticeDetail(noticeNum, resolvedRev),
				changes: getMockNoticeChanges(noticeNum)
			};
		}

		const detail = await apiClient.getNoticeDetail(noticeNum, { rev: resolvedRev }, fetch);
		const changes = await apiClient
			.getNoticeChanges(noticeNum, { limit: 30 }, fetch)
			.catch((err) => {
				console.warn(`Failed to load notice changes (${noticeNum}):`, err);
				return {
					noticeNum,
					items: [],
					count: 0
				};
			});
		return { detail, changes };
	} catch (err) {
		console.error(`Failed to load notice detail (${noticeNum}):`, err);
		throw error(404, '요청한 법률안 원문 정보를 찾을 수 없습니다.');
	}
};
