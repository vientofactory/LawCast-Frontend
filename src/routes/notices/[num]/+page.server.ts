import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/api/client';
import type { NoticeChangeTimelineResponse } from '$lib/types/api';
import type { PageServerLoad } from './$types';

const ENABLE_UI_TEST_TIMELINE_MOCK = true;

function buildUiTestTimelineMock(noticeNum: number): NoticeChangeTimelineResponse {
	const now = Date.now();

	return {
		noticeNum,
		items: [
			{
				id: 10001,
				noticeNum,
				detectedAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
				eventType: 'created',
				source: 'archive:upsert',
				eventHeight: 1,
				prevEventHash: null,
				eventHash: 'mock-event-hash-1',
				changedFieldCount: 4,
				hashAlgo: 'sha256',
				canonVersion: 1,
				diffSummary: {
					type: 'mock',
					message: '초기 문서 생성'
				},
				details: [
					{
						id: 20001,
						fieldPath: 'subject',
						changeType: 'added',
						beforeValue: null,
						afterValue: 'AI·데이터 산업 진흥에 관한 법률안',
						beforeHash: null,
						afterHash: null
					},
					{
						id: 20002,
						fieldPath: 'proposer',
						changeType: 'added',
						beforeValue: null,
						afterValue: '홍길동 의원 외 12인',
						beforeHash: null,
						afterHash: null
					}
				]
			},
			{
				id: 10002,
				noticeNum,
				detectedAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
				eventType: 'updated',
				source: 'archive:updateSourceHtml',
				eventHeight: 2,
				prevEventHash: 'mock-event-hash-1',
				eventHash: 'mock-event-hash-2',
				changedFieldCount: 2,
				hashAlgo: 'sha256',
				canonVersion: 1,
				diffSummary: {
					type: 'mock',
					message: '문구 및 처리 상태 변경'
				},
				details: [
					{
						id: 20003,
						fieldPath: 'proposalReason',
						changeType: 'modified',
						beforeValue: '기존 제안 이유 초안',
						afterValue: '개정된 제안 이유(이해관계자 의견 반영)',
						beforeHash: null,
						afterHash: null
					},
					{
						id: 20004,
						fieldPath: 'isDone',
						changeType: 'modified',
						beforeValue: 'false',
						afterValue: 'true',
						beforeHash: null,
						afterHash: null
					}
				]
			}
		],
		count: 2
	};
}

export const load: PageServerLoad = async ({ params, fetch }) => {
	const noticeNum = Number(params.num);

	if (!Number.isInteger(noticeNum) || noticeNum <= 0) {
		throw error(400, '유효하지 않은 법률안 번호입니다.');
	}

	try {
		const detail = await apiClient.getNoticeDetail(noticeNum, fetch);
		const changes = ENABLE_UI_TEST_TIMELINE_MOCK
			? buildUiTestTimelineMock(noticeNum)
			: await apiClient.getNoticeChanges(noticeNum, { limit: 30 }, fetch).catch((err) => {
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
