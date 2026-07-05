import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockNoticeChanges,
	getMockNoticeDetail
} from '$lib/server/diffchain-ui-mock';

function parseRevisionQuery(revRaw: string | null): number | undefined {
	if (revRaw === null || revRaw.trim() === '') {
		return undefined;
	}

	const normalized = revRaw.trim();
	if (!/^[1-9]\d*$/.test(normalized)) {
		throw error(400, '리비전 값은 1 이상의 정수여야 합니다.');
	}

	return Number.parseInt(normalized, 10);
}

function getHttpStatus(value: unknown): number | null {
	const status = (value as { status?: unknown } | undefined)?.status;
	return typeof status === 'number' ? status : null;
}

function getErrorMessage(value: unknown): string | null {
	const message = (value as { message?: unknown } | undefined)?.message;
	return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const noticeNum = Number(params.num);

	if (!Number.isInteger(noticeNum) || noticeNum <= 0) {
		throw error(400, '유효하지 않은 법률안 번호입니다.');
	}

	const resolvedRev = parseRevisionQuery(url.searchParams.get('rev'));

	try {
		if (isDiffchainUiMockEnabled()) {
			return {
				detail: getMockNoticeDetail(noticeNum, resolvedRev),
				changes: getMockNoticeChanges(noticeNum)
			};
		}

		const detail = await apiClient.getNoticeDetail(noticeNum, { rev: resolvedRev }, fetch);
		const changes = await apiClient
			.getNoticeChanges(noticeNum, { limit: 1000 }, fetch)
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

		const status = getHttpStatus(err);
		if (status === 400) {
			throw error(400, getErrorMessage(err) ?? '리비전 값이 유효하지 않습니다.');
		}

		if (status === 404) {
			throw error(404, '요청한 법률안 원문 정보를 찾을 수 없습니다.');
		}

		if (status && status >= 400 && status < 500) {
			throw error(status, getErrorMessage(err) ?? '요청을 처리할 수 없습니다.');
		}

		throw error(500, '법률안 정보를 불러오는 중 오류가 발생했습니다.');
	}
};
