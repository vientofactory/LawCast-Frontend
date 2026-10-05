import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiClient } from '$lib/api/client';
import { getMockNoticeDetail, isDiffchainUiMockEnabled } from '$lib/server/diffchain-ui-mock';
import { renderBillOgImage } from '$lib/server/og-image';
import type { NoticeDetail } from '$lib/types/api';

function getHttpStatus(value: unknown): number | null {
	const status = (value as { status?: unknown } | undefined)?.status;
	return typeof status === 'number' ? status : null;
}

/**
 * Serves the dynamic Open Graph image for a single bill. The bill fields are
 * loaded exactly like the detail page so the image always matches the page
 * that references it via og:image.
 */
export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const noticeNum = Number.parseInt(params.num, 10);
	if (!Number.isInteger(noticeNum) || noticeNum <= 0) {
		throw error(400, '유효하지 않은 법률안 번호입니다.');
	}

	let detail: NoticeDetail;
	try {
		detail = isDiffchainUiMockEnabled()
			? getMockNoticeDetail(noticeNum)
			: await apiClient.getNoticeDetail(noticeNum, {}, fetch);
	} catch (err) {
		const status = getHttpStatus(err);
		if (status === 404) {
			throw error(404, '요청한 법률안 원문 정보를 찾을 수 없습니다.');
		}
		if (status === 429) {
			throw error(429, '요청이 너무 많습니다.');
		}
		console.error(`Failed to load notice detail for OG image (${noticeNum}):`, err);
		throw error(502, '법률안 정보를 불러오지 못했습니다.');
	}

	const png = await renderBillOgImage(
		{
			title: detail.notice.subject,
			committee: detail.originalContent.committee ?? detail.notice.committee ?? '',
			noticePeriod: detail.originalContent.noticePeriod ?? '',
			proposer: detail.originalContent.proposer ?? ''
		},
		url.origin
	);

	// BodyInit only accepts ArrayBuffer-backed views, not ArrayBufferLike ones.
	return new Response(new Uint8Array(png), {
		headers: {
			'Content-Type': 'image/png',
			// Share crawlers re-fetch often; keep the rendered image briefly cacheable.
			'Cache-Control': 'public, max-age=300'
		}
	});
};
