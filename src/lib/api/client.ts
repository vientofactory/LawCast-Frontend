import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import NProgress from 'nprogress';
import {
	isChallengeStatus,
	isCloudflareChallengeHeader,
	isJsonContentType,
	isUnderAttackReloadEnabled
} from '$lib/utils/cloudflare-challenge';
import type {
	Notice,
	NoticeDetail,
	NoticeChangeTimelineResponse,
	RecentNoticeChangesResponse,
	ComparableChangeSummary,
	ChangeEventType,
	ArchiveNoticeListResponse,
	QuickKeywordSuggestionsResponse,
	SearchNoticesResult,
	SystemStats,
	SystemHealth,
	ApiResponse,
	WebhookRegistrationRequest,
	WebPushPublicConfig,
	WebPushSubscriptionRequest,
	DiscussionWebPushStatus,
	WebPushNoticeStatus,
	ApiError,
	CrawlingTransparencyData,
	ProposalStatisticsData,
	ProposalStatisticsGranularity,
	DiscussionThread,
	DiscussionComment,
	DiscussionThreadListResponse,
	DiscussionThreadDetailResponse,
	CreateThreadPayload,
	CreateCommentPayload,
	UpdateCommentPayload,
	DeleteCommentPayload,
	UpdateThreadStatusPayload
} from '../types/api';

const BASE_URL = '/api';

type Fetch = typeof fetch;

let activeRequests = 0;

const CLOUDFLARE_CHALLENGE_ERROR_CODE = 'LC_CF_CHALLENGE_DETECTED';
const CF_CHALLENGE_FEATURE_ENABLED = isUnderAttackReloadEnabled(
	env.PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED
);

function startProgress() {
	if (browser) {
		if (activeRequests === 0) {
			NProgress.start();
		}
		activeRequests++;
	}
}

function stopProgress() {
	if (browser) {
		activeRequests--;
		if (activeRequests <= 0) {
			activeRequests = 0;
			NProgress.done();
		}
	}
}

async function request<T>(
	path: string,
	options: RequestInit = {},
	customFetch: Fetch = fetch
): Promise<T> {
	const url = `${BASE_URL}${path}`;

	// 개발 환경 로깅
	if (import.meta.env.DEV) {
		console.log(`API Request: ${options.method || 'GET'} ${url}`);
	}

	const defaultHeaders = {
		'Content-Type': 'application/json'
	};

	startProgress();

	try {
		const response = await customFetch(url, {
			...options,
			headers: {
				...defaultHeaders,
				...options.headers
			}
		});

		// 개발 환경 응답 로깅
		if (import.meta.env.DEV) {
			console.log(`API Response: ${response.status} ${url}`);
		}

		const contentType = response.headers.get('content-type') || '';
		const isJsonResponse = isJsonContentType(contentType);

		if (CF_CHALLENGE_FEATURE_ENABLED && isChallengeStatus(response.status)) {
			if (isCloudflareChallengeHeader(response) || !isJsonResponse) {
				throw {
					status: response.status || 503,
					message: CLOUDFLARE_CHALLENGE_ERROR_CODE
				};
			}
		}

		if (!isJsonResponse) {
			const textPayload = await response.text();

			if (!response.ok) {
				throw {
					status: response.status,
					message: textPayload?.slice(0, 300) || 'Unexpected non-JSON API response'
				};
			}

			throw {
				status: response.status,
				message: 'Unexpected non-JSON API response'
			};
		}

		const data = await response.json();

		if (!response.ok) {
			// 에러 데이터 구성
			const errorData = {
				status: response.status,
				message: data?.message,
				errors: data?.errors,
				retryAfter:
					parseRetryAfter(response.headers.get('retry-after')) ??
					parseRetryAfterValue(data?.retryAfter)
			};
			throw errorData;
		}

		const envelope = data as ApiResponse<T>;
		if (envelope && typeof envelope === 'object' && 'success' in envelope) {
			if (envelope.data !== undefined) {
				return envelope.data;
			}

			return data as T;
		}

		return data as T;
	} catch (error) {
		throw normalizeError(error);
	} finally {
		stopProgress();
	}
}

function getErrorMessage(error: unknown): string {
	const err = error as { message?: string; errors?: string[]; status?: number; name?: string };

	if (err?.errors && Array.isArray(err.errors) && err.errors.length > 0)
		return err.errors.join(' ');
	if (err?.message) return err.message;

	switch (err?.status) {
		case 400:
			return '입력 데이터가 올바르지 않습니다.';
		case 401:
			return '인증이 필요합니다.';
		case 403:
			return '접근 권한이 없습니다.';
		case 404:
			return '요청한 리소스를 찾을 수 없습니다.';
		case 409:
			return '이미 존재하는 데이터입니다.';
		case 429:
			return '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.';
		case 500:
		case 502:
		case 503:
		case 504:
			return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
		default:
			// 네트워크 에러 등
			if (error instanceof Error) {
				if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
					return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
				}
				if (error.message.includes('Network Error') || error.message.includes('fetch')) {
					return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
				}
				return error.message;
			}
			return '알 수 없는 오류가 발생했습니다.';
	}
}

function normalizeError(error: unknown): ApiError {
	const message = getErrorMessage(error);
	const apiError: ApiError = new Error(message);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	apiError.status = (error as any)?.status;
	apiError.retryAfter = (error as { retryAfter?: number } | undefined)?.retryAfter;
	// 필요하다면 원본 response나 data를 첨부할 수 있음
	return apiError;
}

function parseRetryAfter(value: string | null): number | undefined {
	if (!value) return undefined;
	const seconds = Number.parseInt(value, 10);
	return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function parseRetryAfterValue(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function isRateLimitError(error: unknown): error is ApiError {
	return (error as { status?: number } | undefined)?.status === 429;
}

export function getRateLimitRetryAfter(error: unknown, fallbackSeconds = 60): number {
	const retryAfter = (error as { retryAfter?: number } | undefined)?.retryAfter;
	return typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : fallbackSeconds;
}

/**
 * 최근 입법예고 조회
 */
export async function getRecentNotices(customFetch?: Fetch): Promise<Notice[]> {
	try {
		return await request<Notice[]>('/notices/recent', { method: 'GET' }, customFetch);
	} catch (error) {
		console.error('Failed to load recent notices:', error);
		throw normalizeError(error);
	}
}

export async function getQuickKeywordSuggestions(
	params: { limit?: number } = {},
	customFetch?: Fetch
): Promise<QuickKeywordSuggestionsResponse> {
	try {
		const query = new URLSearchParams();
		if (params.limit && params.limit > 0) {
			query.set('limit', String(params.limit));
		}
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<QuickKeywordSuggestionsResponse>(
			`/notices/keywords${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load quick keyword suggestions:', error);
		throw normalizeError(error);
	}
}

/**
 * 아카이브 입법예고 목록 조회 (검색/페이지네이션)
 */
export async function getArchivedNotices(
	params: {
		page?: number;
		limit?: number;
		search?: string;
		startDate?: string;
		endDate?: string;
		sortOrder?: 'asc' | 'desc';
		isDone?: boolean;
		fullText?: boolean;
		noticeNums?: number[];
	} = {},
	customFetch?: Fetch
): Promise<ArchiveNoticeListResponse> {
	try {
		const query = new URLSearchParams();

		if (params.page && params.page > 0) {
			query.set('page', String(params.page));
		}

		if (params.limit && params.limit > 0) {
			query.set('limit', String(params.limit));
		}

		if (params.search?.trim()) {
			query.set('search', params.search.trim());
		}

		if (params.startDate?.trim()) {
			query.set('startDate', params.startDate.trim());
		}

		if (params.endDate?.trim()) {
			query.set('endDate', params.endDate.trim());
		}

		if (params.sortOrder === 'asc' || params.sortOrder === 'desc') {
			query.set('sortOrder', params.sortOrder);
		}

		if (params.isDone !== undefined) {
			query.set('isDone', String(params.isDone));
		}

		if (params.fullText === true) {
			query.set('fullText', 'true');
		}

		if (params.noticeNums && params.noticeNums.length > 0) {
			const deduped = Array.from(
				new Set(
					params.noticeNums
						.map((value) => Number(value))
						.filter((value) => Number.isInteger(value) && value > 0)
				)
			);

			if (deduped.length > 0) {
				query.set('noticeNums', deduped.join(','));
			}
		}

		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<ArchiveNoticeListResponse>(
			`/notices/archive${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load archived notices:', error);
		throw normalizeError(error);
	}
}

/**
 * 입법예고 통합 검색 (아카이브 DB + 실시간 크롤러 폴백)
 */
export async function searchNotices(
	params: {
		q: string;
		page?: number;
		limit?: number;
		includeDone?: boolean;
	},
	customFetch?: Fetch
): Promise<SearchNoticesResult> {
	try {
		const query = new URLSearchParams();
		query.set('q', params.q.trim());
		if (params.page && params.page > 0) query.set('page', String(params.page));
		if (params.limit && params.limit > 0) query.set('limit', String(params.limit));
		if (params.includeDone === false) query.set('includeDone', 'false');
		return await request<SearchNoticesResult>(
			`/notices/search?${query.toString()}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to search notices:', error);
		throw normalizeError(error);
	}
}

/**
 * 입법예고 상세 조회 (원문 포함)
 */
export async function getNoticeDetail(
	noticeNum: number,
	params: { rev?: number } = {},
	customFetch?: Fetch
): Promise<NoticeDetail> {
	try {
		const query = new URLSearchParams();
		if (params.rev && params.rev > 0) {
			query.set('rev', String(params.rev));
		}
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<NoticeDetail>(
			`/notices/${noticeNum}/detail${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error(`Failed to load notice detail (${noticeNum}):`, error);
		throw normalizeError(error);
	}
}

/**
 * 의안번호별 변경 추적 타임라인 조회
 */
export async function getNoticeChanges(
	noticeNum: number,
	params: { limit?: number } = {},
	customFetch?: Fetch
): Promise<NoticeChangeTimelineResponse> {
	try {
		const query = new URLSearchParams();
		if (params.limit && params.limit > 0) {
			query.set('limit', String(params.limit));
		}

		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<NoticeChangeTimelineResponse>(
			`/notices/${noticeNum}/changes${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error(`Failed to load notice changes (${noticeNum}):`, error);
		throw normalizeError(error);
	}
}

/**
 * 전체 의안 변경 이벤트 목록 조회
 */
export async function getRecentNoticeChanges(
	params: {
		page?: number;
		limit?: number;
		search?: string;
		noticeNum?: number;
		eventType?: ChangeEventType;
		sortOrder?: 'asc' | 'desc';
		excludeLegacyGenesisSource?: boolean;
		excludeIsDoneEvents?: boolean;
		comparableOnly?: boolean;
		fromEventId?: number;
		toEventId?: number;
		fromDetectedAt?: string;
		toDetectedAt?: string;
		anchorEventId?: number;
	} = {},
	customFetch?: Fetch
): Promise<RecentNoticeChangesResponse> {
	try {
		const query = new URLSearchParams();
		if (params.page && params.page > 0) query.set('page', String(params.page));
		if (params.limit && params.limit > 0) query.set('limit', String(params.limit));
		if (params.search?.trim()) query.set('search', params.search.trim());
		if (params.noticeNum && params.noticeNum > 0) query.set('noticeNum', String(params.noticeNum));
		if (params.eventType) query.set('eventType', params.eventType);
		if (params.sortOrder === 'asc' || params.sortOrder === 'desc') {
			query.set('sortOrder', params.sortOrder);
		}
		if (params.excludeLegacyGenesisSource === true) query.set('excludeLegacyGenesisSource', 'true');
		if (params.excludeIsDoneEvents === true) query.set('excludeIsDoneEvents', 'true');
		if (params.comparableOnly === true) query.set('comparableOnly', 'true');
		if (params.fromEventId && params.fromEventId > 0) {
			query.set('fromEventId', String(params.fromEventId));
		}
		if (params.toEventId && params.toEventId > 0) {
			query.set('toEventId', String(params.toEventId));
		}
		if (params.fromDetectedAt?.trim()) {
			query.set('fromDetectedAt', params.fromDetectedAt.trim());
		}
		if (params.toDetectedAt?.trim()) {
			query.set('toDetectedAt', params.toDetectedAt.trim());
		}
		if (params.anchorEventId && params.anchorEventId > 0) {
			query.set('anchorEventId', String(params.anchorEventId));
		}

		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<RecentNoticeChangesResponse>(
			`/notices/changes${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load recent notice changes:', error);
		throw normalizeError(error);
	}
}

export async function getComparableNoticeChangesSummary(
	customFetch?: Fetch
): Promise<ComparableChangeSummary> {
	try {
		return await request<ComparableChangeSummary>(
			'/notices/changes/summary',
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load comparable notice changes summary:', error);
		throw normalizeError(error);
	}
}

/**
 * 시스템 통계 조회
 */
export async function getSystemStats(customFetch?: Fetch): Promise<SystemStats> {
	try {
		return await request<SystemStats>('/stats', { method: 'GET' }, customFetch);
	} catch (error) {
		console.error('Failed to load system stats:', error);
		throw normalizeError(error);
	}
}

/**
 * 시스템 건강도 조회
 */
export async function getSystemHealth(customFetch?: Fetch): Promise<SystemHealth> {
	try {
		return await request<SystemHealth>('/webhooks/system-health', { method: 'GET' }, customFetch);
	} catch (error) {
		console.error('Failed to load system health:', error);
		throw normalizeError(error);
	}
}

/**
 * 웹훅 등록
 */
export async function registerWebhook(
	requestData: WebhookRegistrationRequest,
	customFetch?: Fetch
): Promise<{ success: boolean; message?: string }> {
	try {
		const response = await request<{ success: boolean; message?: string }>(
			'/webhooks',
			{
				method: 'POST',
				body: JSON.stringify(requestData)
			},
			customFetch
		);
		return response;
	} catch (error) {
		const err = error as { status?: number; message?: string };
		// eslint-disable-next-line no-useless-assignment
		let message = '';
		if (err?.status === 409) {
			message = '이미 등록된 웹훅 URL입니다.';
		} else if (err?.status === 429) {
			message = '너무 많은 웹훅이 등록되어 있습니다.';
		} else {
			// request에서 이미 normalize된 에러가 올 수도 있음
			message = error instanceof Error ? error.message : getErrorMessage(error);
		}

		const apiError: ApiError = new Error(message);
		apiError.status = err?.status;
		throw apiError;
	}
}

export async function getWebPushPublicConfig(customFetch?: Fetch): Promise<WebPushPublicConfig> {
	try {
		return await request<WebPushPublicConfig>('/push/public-key', { method: 'GET' }, customFetch);
	} catch (error) {
		console.error('Failed to load web push public config:', error);
		throw normalizeError(error);
	}
}

export async function registerWebPushSubscription(
	requestData: WebPushSubscriptionRequest,
	customFetch?: Fetch
): Promise<{ id: number }> {
	try {
		return await request<{ id: number }>(
			'/push/subscriptions',
			{
				method: 'POST',
				body: JSON.stringify(requestData)
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to register web push subscription:', error);
		throw normalizeError(error);
	}
}

export async function getDiscussionWebPushStatus(
	threadId: number,
	endpoint: string,
	customFetch?: Fetch
): Promise<DiscussionWebPushStatus> {
	try {
		return await request<DiscussionWebPushStatus>(
			`/push/subscriptions/discussions/${threadId}/status?endpoint=${encodeURIComponent(endpoint)}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load discussion web push status:', error);
		throw normalizeError(error);
	}
}

export async function getWebPushNoticeStatus(
	endpoint: string,
	customFetch?: Fetch
): Promise<WebPushNoticeStatus> {
	try {
		return await request<WebPushNoticeStatus>(
			`/push/subscriptions/notice-status?endpoint=${encodeURIComponent(endpoint)}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load notice web push status:', error);
		throw normalizeError(error);
	}
}

export async function updateWebPushNoticePreference(
	endpoint: string,
	enabled: boolean,
	customFetch?: Fetch
): Promise<void> {
	try {
		await request(
			'/push/subscriptions/preferences',
			{
				method: 'PATCH',
				body: JSON.stringify({ endpoint, noticeNotificationsEnabled: enabled })
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to update notice web push preference:', error);
		throw normalizeError(error);
	}
}

export async function unregisterDiscussionWebPushBinding(
	threadId: number,
	endpoint: string,
	customFetch?: Fetch
): Promise<void> {
	try {
		await request(
			`/push/subscriptions/discussions/${threadId}`,
			{
				method: 'DELETE',
				body: JSON.stringify({ endpoint })
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to unregister discussion web push binding:', error);
		throw normalizeError(error);
	}
}

export async function unregisterWebPushSubscription(
	endpoint: string,
	customFetch?: Fetch
): Promise<void> {
	try {
		await request<{ success: boolean }>(
			'/push/subscriptions',
			{
				method: 'DELETE',
				body: JSON.stringify({ endpoint })
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to unregister web push subscription:', error);
		throw normalizeError(error);
	}
}

/**
 * 크롤링 투명성 통계 조회
 */
export async function getCrawlingTransparency(
	customFetch?: Fetch
): Promise<CrawlingTransparencyData> {
	try {
		return await request<CrawlingTransparencyData>(
			'/crawling-transparency',
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load crawling transparency:', error);
		throw normalizeError(error);
	}
}

/**
 * 법률안 발의 통계 조회
 */
export async function getProposalStatistics(
	params: {
		granularity?: ProposalStatisticsGranularity;
		startDate?: string;
		endDate?: string;
	} = {},
	customFetch?: Fetch
): Promise<ProposalStatisticsData> {
	try {
		const query = new URLSearchParams();
		if (params.granularity) {
			query.set('granularity', params.granularity);
		}
		if (params.startDate?.trim()) {
			query.set('startDate', params.startDate.trim());
		}
		if (params.endDate?.trim()) {
			query.set('endDate', params.endDate.trim());
		}
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<ProposalStatisticsData>(
			`/stats/proposals${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load proposal statistics:', error);
		throw normalizeError(error);
	}
}

// ── Discussions API ─────────────────────────────────────────────────────

/**
 * 법률안별 토론 스레드 목록 조회
 */
export async function getNoticeDiscussions(
	noticeNum: number,
	params: { page?: number; limit?: number } = {},
	customFetch?: Fetch
): Promise<DiscussionThreadListResponse> {
	try {
		const query = new URLSearchParams();
		if (params.page && params.page > 0) query.set('page', String(params.page));
		if (params.limit && params.limit > 0) query.set('limit', String(params.limit));
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<DiscussionThreadListResponse>(
			`/notices/${noticeNum}/discussions${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load notice discussions:', error);
		throw normalizeError(error);
	}
}

/**
 * 새 토론 스레드 개설 및 #1 의견 등록
 */
export async function createNoticeDiscussion(
	noticeNum: number,
	payload: CreateThreadPayload,
	customFetch?: Fetch
): Promise<DiscussionThreadDetailResponse> {
	try {
		return await request<DiscussionThreadDetailResponse>(
			`/notices/${noticeNum}/discussions`,
			{
				method: 'POST',
				body: JSON.stringify(payload)
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to create notice discussion:', error);
		throw normalizeError(error);
	}
}

/**
 * 토론 스레드 상세 및 댓글 페이지 조회
 */
export async function getDiscussionThread(
	threadId: number,
	params: { cursor?: number; limit?: number } = {},
	customFetch?: Fetch
): Promise<DiscussionThreadDetailResponse> {
	try {
		const query = new URLSearchParams();
		if (params.cursor !== undefined && params.cursor >= 0) {
			query.set('cursor', String(params.cursor));
		}
		if (params.limit !== undefined && params.limit > 0) {
			query.set('limit', String(params.limit));
		}
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return await request<DiscussionThreadDetailResponse>(
			`/discussions/threads/${threadId}${suffix}`,
			{ method: 'GET' },
			customFetch
		);
	} catch (error) {
		console.error('Failed to load discussion thread:', error);
		throw normalizeError(error);
	}
}

/**
 * 토론 스레드에 새 의견(#N) 등록
 */
export async function addDiscussionComment(
	threadId: number,
	payload: CreateCommentPayload,
	customFetch?: Fetch
): Promise<DiscussionComment> {
	try {
		return await request<DiscussionComment>(
			`/discussions/threads/${threadId}/comments`,
			{
				method: 'POST',
				body: JSON.stringify(payload)
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to add discussion comment:', error);
		throw normalizeError(error);
	}
}

/**
 * 의견 수정 (비밀번호 일치 확인)
 */
export async function updateDiscussionComment(
	commentId: number,
	payload: UpdateCommentPayload,
	customFetch?: Fetch
): Promise<DiscussionComment> {
	try {
		return await request<DiscussionComment>(
			`/discussions/comments/${commentId}`,
			{
				method: 'PATCH',
				body: JSON.stringify(payload)
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to update discussion comment:', error);
		throw normalizeError(error);
	}
}

/**
 * 의견 소프트 삭제 (비밀번호 일치 확인)
 */
export async function deleteDiscussionComment(
	commentId: number,
	payload: DeleteCommentPayload,
	customFetch?: Fetch
): Promise<DiscussionComment> {
	try {
		return await request<DiscussionComment>(
			`/discussions/comments/${commentId}`,
			{
				method: 'DELETE',
				body: JSON.stringify(payload)
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to delete discussion comment:', error);
		throw normalizeError(error);
	}
}

/**
 * 토론 스레드 상태 변경 (열림/닫힘)
 */
export async function updateDiscussionThreadStatus(
	threadId: number,
	payload: UpdateThreadStatusPayload,
	customFetch?: Fetch
): Promise<DiscussionThread> {
	try {
		return await request<DiscussionThread>(
			`/discussions/threads/${threadId}/status`,
			{
				method: 'PATCH',
				body: JSON.stringify(payload)
			},
			customFetch
		);
	} catch (error) {
		console.error('Failed to update discussion thread status:', error);
		throw normalizeError(error);
	}
}

// 기존 코드와의 호환성을 위한 객체 export
export const apiClient = {
	getRecentNotices,
	getQuickKeywordSuggestions,
	getArchivedNotices,
	searchNotices,
	getNoticeDetail,
	getNoticeChanges,
	getRecentNoticeChanges,
	getComparableNoticeChangesSummary,
	getSystemStats,
	getSystemHealth,
	registerWebhook,
	getWebPushPublicConfig,
	registerWebPushSubscription,
	getDiscussionWebPushStatus,
	getWebPushNoticeStatus,
	updateWebPushNoticePreference,
	unregisterDiscussionWebPushBinding,
	unregisterWebPushSubscription,
	getCrawlingTransparency,
	getProposalStatistics,
	getNoticeDiscussions,
	createNoticeDiscussion,
	getDiscussionThread,
	addDiscussionComment,
	updateDiscussionComment,
	deleteDiscussionComment,
	updateDiscussionThreadStatus
};
