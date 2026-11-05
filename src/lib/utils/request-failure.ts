export type FailureKind =
	| 'rate-limit'
	| 'network'
	| 'timeout'
	| 'server'
	| 'unauthorized'
	| 'forbidden'
	| 'not-found'
	| 'invalid-request'
	| 'invalid-response'
	| 'unknown';
export interface LoadErrorPayload {
	message: string;
	status?: number;
	kind?: FailureKind;
	/** Only HTTP 429 may carry a client cooldown. */
	retryAfter?: number;
}

export function getFailureStatus(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') return undefined;
	const value = (error as { status?: unknown }).status;
	return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
		? value
		: undefined;
}
export function getFailureKind(error: unknown): FailureKind {
	const status = getFailureStatus(error);
	if (status === 429) return 'rate-limit';
	if (status === 401) return 'unauthorized';
	if (status === 403) return 'forbidden';
	if (status === 404) return 'not-found';
	if (status === 408 || status === 504) return 'timeout';
	if (status && status >= 500) return 'server';
	if (status && status >= 400) return 'invalid-request';
	const value = error as {
		kind?: string;
		name?: string;
		message?: string;
		cause?: { code?: string };
	} | null;
	if (value?.kind === 'invalid-response' || (status && status < 400)) return 'invalid-response';
	if (
		value?.kind === 'timeout' ||
		value?.name === 'TimeoutError' ||
		/TIMEOUT|ETIMEDOUT/.test(value?.cause?.code ?? '')
	)
		return 'timeout';
	if (
		value?.kind === 'network' ||
		/^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ENETUNREACH)$/.test(
			value?.cause?.code ?? ''
		) ||
		/fetch|network|ECONNREFUSED|ENOTFOUND|^Load failed$/i.test(value?.message ?? '')
	)
		return 'network';
	return 'unknown';
}
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
	if (!value?.trim()) return undefined;
	const raw = value.trim();
	const seconds = /^\d+$/.test(raw)
		? Number(raw)
		: /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw)
			? (Date.parse(raw) - now) / 1000
			: NaN;
	return Number.isFinite(seconds) ? Math.min(86400, Math.max(0, Math.ceil(seconds))) : undefined;
}
export function getFailureRetryAfter(error: unknown, fallback = 60): number {
	if (getFailureStatus(error) !== 429) return 0;
	const value = (error as { retryAfter?: unknown }).retryAfter;
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
		? Math.min(86400, Math.ceil(value))
		: fallback;
}
export const FAILURE_PRESENTATION = {
	'rate-limit': {
		title: '요청이 너무 많습니다',
		guidance: '요청 한도에 도달했습니다. 안내된 시간이 지난 후 다시 시도해주세요.',
		retryable: true
	},
	network: {
		title: '서버에 연결하지 못했습니다',
		guidance:
			'연결 상태 또는 데이터 서버의 응답을 확인할 수 없습니다. 연결을 확인하거나 잠시 후 다시 시도해주세요.',
		retryable: true
	},
	timeout: {
		title: '응답 시간이 초과되었습니다',
		guidance: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
		retryable: true
	},
	server: {
		title: '서버에 일시적인 문제가 있습니다',
		guidance: '데이터 서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
		retryable: true
	},
	unauthorized: {
		title: '인증이 필요합니다',
		guidance: '인증 상태를 확인한 뒤 다시 이용해주세요.',
		retryable: false
	},
	forbidden: {
		title: '접근이 허용되지 않았습니다',
		guidance: '접근 권한 또는 브라우저의 보안 확인 상태를 확인해주세요.',
		retryable: false
	},
	'not-found': {
		title: '요청한 정보를 찾을 수 없습니다',
		guidance: '주소나 검색 조건을 확인해주세요.',
		retryable: false
	},
	'invalid-request': {
		title: '요청 내용을 확인해주세요',
		guidance: '입력 내용과 검색 조건을 확인한 뒤 다시 이용해주세요.',
		retryable: false
	},
	'invalid-response': {
		title: '서버 응답을 확인할 수 없습니다',
		guidance: '올바른 형식의 데이터를 받지 못했습니다. 잠시 후 다시 시도해주세요.',
		retryable: true
	},
	unknown: {
		title: '데이터를 불러오지 못했습니다',
		guidance: '요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
		retryable: true
	}
} as const;

/** Only a failed connection without an upstream HTTP response is offline. */
export function isServerUnavailable(error: unknown): boolean {
	return getFailureStatus(error) === undefined && getFailureKind(error) === 'network';
}

/** The proxy reserves this header for its own connection failures, never upstream HTTP errors. */
export const PROXY_CONNECTION_FAILURE_HEADER = 'x-lawcast-proxy-connection-failure';
