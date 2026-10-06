/**
 * Maps raw API errors to user-facing Korean messages.
 * Raw infrastructure text (e.g. "Bad Gateway") must never reach the UI; callers
 * log the original error to the console before mapping it here.
 */
const KOREAN_TEXT = /[가-힣]/;

export function toUserFacingErrorMessage(error: unknown, fallback: string): string {
	const status =
		typeof error === 'object' && error !== null && 'status' in error
			? (error as { status?: number }).status
			: undefined;
	const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

	// Server messages already written in Korean (validation feedback etc.) are
	// safe and useful to keep as-is.
	if (raw && KOREAN_TEXT.test(raw)) {
		return raw;
	}

	if (typeof status === 'number' && status >= 500) {
		return `${fallback} 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`;
	}

	if (typeof status !== 'number') {
		return `${fallback} 네트워크 연결을 확인한 후 다시 시도해주세요.`;
	}

	if (status === 400 || status === 422) {
		return `${fallback} 입력 내용을 확인한 후 다시 시도해주세요.`;
	}

	return fallback;
}
