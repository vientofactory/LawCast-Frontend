import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockNoticeDetail,
	getMockDiscussionThread
} from '$lib/server/diffchain-ui-mock';

function getHttpStatus(value: unknown): number | null {
	const status = (value as { status?: unknown } | undefined)?.status;
	return typeof status === 'number' ? status : null;
}

function getErrorMessage(value: unknown): string | null {
	const message = (value as { message?: unknown } | undefined)?.message;
	return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

export const load: PageServerLoad = async ({ params, fetch }) => {
	const noticeNum = Number(params.num);
	const threadId = Number(params.threadId);

	if (!Number.isInteger(noticeNum) || noticeNum <= 0) {
		throw error(400, '유효하지 않은 법률안 번호입니다.');
	}

	if (!Number.isInteger(threadId) || threadId <= 0) {
		throw error(400, '유효하지 않은 토론 스레드 번호입니다.');
	}

	try {
		if (isDiffchainUiMockEnabled()) {
			return {
				noticeNum,
				threadId,
				detail: getMockNoticeDetail(noticeNum),
				discussion: getMockDiscussionThread(threadId, noticeNum)
			};
		}

		const detail = await apiClient.getNoticeDetail(noticeNum, {}, fetch);
		let discussion;
		try {
			discussion = await apiClient.getDiscussionThread(threadId, {}, fetch);
		} catch (discussionError) {
			if (getHttpStatus(discussionError) === 429) {
				return {
					noticeNum,
					threadId,
					detail,
					discussion: null,
					discussionError: {
						status: 429,
						message: getErrorMessage(discussionError) ?? '요청이 너무 많습니다.',
						retryAfter: (discussionError as { retryAfter?: number } | undefined)?.retryAfter ?? 60
					}
				};
			}
			throw discussionError;
		}

		if (discussion.thread.noticeNum !== noticeNum) {
			throw error(404, '해당 법률안의 토론 스레드를 찾을 수 없습니다.');
		}

		return {
			noticeNum,
			threadId,
			detail,
			discussion
		};
	} catch (err) {
		console.error(
			`Failed to load discussion thread (notice: ${noticeNum}, thread: ${threadId}):`,
			err
		);

		const status = getHttpStatus(err);
		if (status === 400) {
			throw error(400, getErrorMessage(err) ?? '요청이 올바르지 않습니다.');
		}

		if (status === 404) {
			throw error(404, '요청한 토론 스레드를 찾을 수 없습니다.');
		}

		if (status && status >= 400 && status < 500) {
			throw error(status, getErrorMessage(err) ?? '요청을 처리할 수 없습니다.');
		}

		throw error(500, '토론 정보를 불러오는 중 오류가 발생했습니다.');
	}
};
