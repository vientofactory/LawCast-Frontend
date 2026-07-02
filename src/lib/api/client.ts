import { browser } from '$app/environment';
import NProgress from 'nprogress';
import type {
	Notice,
	NoticeDetail,
	NoticeChangeTimelineResponse,
	RecentNoticeChangesResponse,
	ChangeEventType,
	ArchiveNoticeListResponse,
	SearchNoticesResult,
	SystemStats,
	SystemHealth,
	ApiResponse,
	WebhookRegistrationRequest,
	ApiError
} from '../types/api';

const BASE_URL = '/api';

type Fetch = typeof fetch;

let activeRequests = 0;

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

		const data = await response.json();

		if (!response.ok) {
			// 에러 데이터 구성
			const errorData = {
				status: response.status,
				message: data?.message,
				errors: data?.errors
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
	// 필요하다면 원본 response나 data를 첨부할 수 있음
	return apiError;
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
	customFetch?: Fetch
): Promise<NoticeDetail> {
	try {
		return await request<NoticeDetail>(
			`/notices/${noticeNum}/detail`,
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
		eventType?: ChangeEventType;
	} = {},
	customFetch?: Fetch
): Promise<RecentNoticeChangesResponse> {
	try {
		const query = new URLSearchParams();
		if (params.page && params.page > 0) query.set('page', String(params.page));
		if (params.limit && params.limit > 0) query.set('limit', String(params.limit));
		if (params.eventType) query.set('eventType', params.eventType);

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

// 기존 코드와의 호환성을 위한 객체 export
export const apiClient = {
	getRecentNotices,
	getArchivedNotices,
	searchNotices,
	getNoticeDetail,
	getNoticeChanges,
	getRecentNoticeChanges,
	getSystemStats,
	getSystemHealth,
	registerWebhook
};
