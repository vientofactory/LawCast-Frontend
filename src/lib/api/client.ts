import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { PUBLIC_API_BASE_URL } from '$env/static/public';
import type {
	Notice,
	SystemStats,
	SystemHealth,
	ApiResponse,
	WebhookRegistrationRequest,
	ApiError
} from '../types/api';

class ApiClient {
	private client: AxiosInstance;

	constructor() {
		this.client = axios.create({
			baseURL: PUBLIC_API_BASE_URL || 'http://localhost:3001/api',
			timeout: 10000,
			headers: {
				'Content-Type': 'application/json'
			}
		});

		// 요청 인터셉터
		this.client.interceptors.request.use(
			(config) => {
				// 요청 로깅 (개발 환경에서만)
				if (import.meta.env.DEV) {
					console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
				}
				return config;
			},
			(error) => {
				return Promise.reject(error);
			}
		);

		// 응답 인터셉터
		this.client.interceptors.response.use(
			(response: AxiosResponse) => {
				// 응답 로깅 (개발 환경에서만)
				if (import.meta.env.DEV) {
					console.log(`API Response: ${response.status} ${response.config.url}`);
				}
				return response;
			},
			(error) => {
				// 에러 변환
				const apiError: ApiError = new Error(this.getErrorMessage(error));
				apiError.status = error.response?.status;
				apiError.response = error.response;
				return Promise.reject(apiError);
			}
		);
	}

	/**
	 * 최근 입법예고 조회
	 */
	async getRecentNotices(): Promise<Notice[]> {
		try {
			const response = await this.client.get<ApiResponse<Notice[]>>('/notices/recent');
			return response.data.data;
		} catch (error) {
			console.error('Failed to load recent notices:', error);
			throw this.handleError(error, '최근 입법예고를 불러오는데 실패했습니다.');
		}
	}

	/**
	 * 시스템 통계 조회
	 */
	async getSystemStats(): Promise<SystemStats> {
		try {
			const response = await this.client.get<ApiResponse<SystemStats>>('/stats');
			return response.data.data;
		} catch (error) {
			console.error('Failed to load system stats:', error);
			throw this.handleError(error, '시스템 통계를 불러오는데 실패했습니다.');
		}
	}

	/**
	 * 시스템 건강도 조회
	 */
	async getSystemHealth(): Promise<SystemHealth> {
		try {
			const response = await this.client.get<ApiResponse<SystemHealth>>('/webhooks/system-health');
			return response.data.data;
		} catch (error) {
			console.error('Failed to load system health:', error);
			throw this.handleError(error, '시스템 건강도를 불러오는데 실패했습니다.');
		}
	}

	/**
	 * 웹훅 등록
	 */
	async registerWebhook(
		request: WebhookRegistrationRequest
	): Promise<{ success: boolean; message?: string }> {
		try {
			const response = await this.client.post<ApiResponse<{ success: boolean; message?: string }>>(
				'/webhooks',
				request
			);
			return {
				success: response.data.success,
				message: response.data.message
			};
		} catch (error) {
			throw this.handleWebhookError(error);
		}
	}

	/**
	 * 에러 메시지 추출
	 */
	private getErrorMessage(error: unknown): string {
		if (axios.isAxiosError(error)) {
			const response = error.response;

			if (response?.data?.message) {
				return response.data.message;
			}

			if (response?.data?.errors && Array.isArray(response.data.errors)) {
				return response.data.errors.join(' ');
			}

			// HTTP 상태 코드별 기본 메시지
			switch (response?.status) {
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
					return '알 수 없는 오류가 발생했습니다.';
			}
		}

		if (error instanceof Error) {
			if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
				return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
			}

			if (error.message.includes('Network Error')) {
				return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
			}

			return error.message;
		}

		return '예상치 못한 오류가 발생했습니다.';
	}

	/**
	 * 일반적인 에러 처리
	 */
	private handleError(error: unknown, defaultMessage: string): ApiError {
		const apiError: ApiError = new Error(this.getErrorMessage(error) || defaultMessage);

		if (axios.isAxiosError(error)) {
			apiError.status = error.response?.status;
			apiError.response = error.response;
		}

		return apiError;
	}

	/**
	 * 웹훅 등록 관련 에러 처리
	 */
	private handleWebhookError(error: unknown): ApiError {
		if (axios.isAxiosError(error)) {
			const response = error.response;
			let message = '';

			switch (response?.status) {
				case 400:
					if (response.data?.errors && Array.isArray(response.data.errors)) {
						message = response.data.errors.join(' ');
					} else {
						message = response.data?.message || '입력 데이터가 올바르지 않습니다.';
					}
					break;
				case 409:
					message = '이미 등록된 웹훅 URL입니다.';
					break;
				case 429:
					message = '너무 많은 웹훅이 등록되어 있습니다.';
					break;
				default:
					message = this.getErrorMessage(error);
			}

			const apiError: ApiError = new Error(message);
			apiError.status = response?.status;
			apiError.response = response;
			return apiError;
		}

		return this.handleError(error, '웹훅 등록에 실패했습니다.');
	}
}

// 싱글톤 인스턴스 생성
export const apiClient = new ApiClient();

// 개별 함수로도 사용 가능하도록 export
export const { getRecentNotices, getSystemStats, getSystemHealth, registerWebhook } = apiClient;
