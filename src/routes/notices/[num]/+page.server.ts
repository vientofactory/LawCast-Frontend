import { markResponseFailure } from '#lib/server/response-cache.ts';
import { error } from '@sveltejs/kit';
import { apiClient } from '#lib/api/client.ts';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockNoticeChanges,
	getMockNoticeDetail
} from '#lib/server/diffchain-ui-mock.ts';
import { toLoadErrorPayload } from '#lib/server/load-error.ts';

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

export const load: PageServerLoad = async ({ params, url, fetch, locals }) => {
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

		// The two reads are independent, so they are issued together and the
		// page waits for the slowest instead of the sum. Error semantics are
		// unchanged: a detail failure still takes the catch path below (the
		// tolerated changes fallbacks are simply ignored), while
		// changes failures keep their own fallbacks.
		const detailPromise = apiClient.getNoticeDetail(noticeNum, { rev: resolvedRev }, fetch);
		const changesPromise = apiClient
			.getNoticeChanges(noticeNum, {}, fetch)
			.then((changes) => ({ changes, changesLoadError: undefined as string | undefined }))
			.catch((err) => {
				markResponseFailure(locals, err);
				return {
					changes: { noticeNum, items: [], count: 0 },
					changesLoadError: '변경 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
				};
			});
		const detail = await detailPromise;
		const { changes, changesLoadError } = await changesPromise;
		return {
			detail,
			changes,
			changesLoadError
		};
	} catch (err) {
		markResponseFailure(locals, err);
		console.error(`Failed to load notice detail (${noticeNum}):`, err);

		const status = getHttpStatus(err);
		if (status === 400) {
			throw error(400, getErrorMessage(err) ?? '리비전 값이 유효하지 않습니다.');
		}

		if (status === 404) {
			throw error(404, '요청한 법률안 원문 정보를 찾을 수 없습니다.');
		}

		// Rate limits (429) are transient, so render the page with the guidance
		// banner instead of falling back to the error page.
		if (status === 429) {
			const loadError = toLoadErrorPayload(err, '요청이 너무 많습니다.');
			return {
				detail: {
					notice: {
						num: noticeNum,
						subject: '법률안 정보를 불러올 수 없습니다',
						proposerCategory: '-',
						committee: '',
						link: '',
						attachments: { pdfFile: '', hwpFile: '' }
					},
					originalContent: {
						contentId: '',
						title: '법률안 정보를 불러올 수 없습니다',
						proposalReason: loadError.message,
						billNumber: null,
						proposer: null,
						proposalDate: null,
						committee: null,
						referralDate: null,
						noticePeriod: null,
						proposalSession: null
					},
					archiveMetadata: {
						archivedAt: null,
						sourceHtmlSha256: null,
						sourceHtmlSize: 0,
						integrity: {
							checkedAt: null,
							passed: null,
							calculatedSha256: null
						},
						http: {
							fetchedAt: null,
							statusCode: null,
							contentType: null,
							etag: null,
							lastModified: null
						}
					},
					screenshotMeta: {
						hasScreenshot: false,
						format: null,
						captureStatus: null,
						captureError: null
					}
				},
				changes: {
					noticeNum,
					items: [],
					count: 0
				},
				loadError
			};
		}

		if (status && status >= 400 && status < 500) {
			throw error(status, getErrorMessage(err) ?? '요청을 처리할 수 없습니다.');
		}

		const failure = toLoadErrorPayload(err, '법률안 정보를 불러오지 못했습니다.');
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
