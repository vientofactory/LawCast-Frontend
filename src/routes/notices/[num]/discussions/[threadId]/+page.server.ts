import { toLoadErrorPayload } from '#lib/server/load-error.ts';
import { error } from '@sveltejs/kit';
import { apiClient } from '#lib/api/client.ts';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockNoticeDetail,
	getMockDiscussionThread
} from '#lib/server/diffchain-ui-mock.ts';

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
				discussion: getMockDiscussionThread(threadId, noticeNum, { limit: 20 }),
				uiMockEnabled: true
			};
		}

		// The two reads are independent, so they are issued together and the
		// page waits for the slowest instead of the sum. The no-op catch
		// keeps the thread read from surfacing as an unhandled rejection on
		// the paths where only the detail result is awaited (detail failure);
		// awaiting it below still observes the original outcome.
		const detailPromise = apiClient.getNoticeDetail(noticeNum, {}, fetch);
		const discussionPromise = apiClient.getDiscussionThread(threadId, {}, fetch);
		void discussionPromise.catch(() => undefined);
		const detail = await detailPromise;
		let discussion;
		try {
			discussion = await discussionPromise;
		} catch (discussionError) {
			const status = getHttpStatus(discussionError);
			if (status && status >= 400 && status < 500 && status !== 429) throw discussionError;
			return {
				noticeNum,
				threadId,
				detail,
				discussion: null,
				discussionError: toLoadErrorPayload(discussionError, '토론 내용을 불러오지 못했습니다.')
			};
		}

		if (discussion.thread.noticeNum !== noticeNum) {
			throw error(404, '해당 법률안의 토론 스레드를 찾을 수 없습니다.');
		}

		return {
			noticeNum,
			threadId,
			detail,
			discussion,
			uiMockEnabled: false
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

		const failure = toLoadErrorPayload(err, '토론 정보를 불러오는 중 오류가 발생했습니다.');
		throw error(
			failure.kind === 'timeout'
				? 504
				: failure.status && failure.status >= 500
					? failure.status
					: 503,
			{ message: failure.message, kind: failure.kind }
		);
	}
};
