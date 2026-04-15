import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const noticeNum = Number(params.num);

	if (!Number.isInteger(noticeNum) || noticeNum <= 0) {
		throw error(400, '유효하지 않은 법률안 번호입니다.');
	}

	try {
		const detail = await apiClient.getNoticeDetail(noticeNum, fetch);
		return { detail };
	} catch (err) {
		console.error(`Failed to load notice detail (${noticeNum}):`, err);
		throw error(404, '요청한 법률안 원문 정보를 찾을 수 없습니다.');
	}
};
