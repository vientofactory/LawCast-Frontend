import { getFailureKind, FAILURE_PRESENTATION } from './request-failure';
/**
 * Maps raw API errors to user-facing Korean messages.
 * Raw infrastructure text (e.g. "Bad Gateway") must never reach the UI; callers
 * log the original error to the console before mapping it here.
 */
const KOREAN_TEXT = /[가-힣]/;

export function toUserFacingErrorMessage(error: unknown, fallback: string): string {
	const kind = getFailureKind(error);
	const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
	if ((kind === 'invalid-request' || kind === 'unknown') && raw && KOREAN_TEXT.test(raw))
		return raw;
	if (kind === 'server')
		return `${fallback} 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`;
	if (kind === 'network')
		return `${fallback} 서버에 연결하지 못했습니다. 네트워크 연결을 확인한 후 다시 시도해주세요.`;
	return `${fallback} ${FAILURE_PRESENTATION[kind].guidance}`;
}
