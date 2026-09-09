import { isRateLimitError, getRateLimitRetryAfter } from '$lib/api/client';

export interface LoadErrorPayload {
	message: string;
	/** Seconds until the client may retry. Present only for 429 responses. */
	retryAfter?: number;
}

/**
 * Convert an unknown load error into a user-facing payload.
 * Rate-limit (429) responses get a friendly Korean message plus the
 * server-provided (or default) `retryAfter` seconds so pages can render a
 * countdown instead of a bare failure message.
 */
export function toLoadErrorPayload(error: unknown, fallbackMessage: string): LoadErrorPayload {
	if (isRateLimitError(error)) {
		const retryAfter = getRateLimitRetryAfter(error);
		return {
			message:
				retryAfter > 0
					? `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도해주세요.`
					: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
			retryAfter
		};
	}

	const message = error instanceof Error && error.message ? error.message : fallbackMessage;
	return { message };
}

/**
 * True when the error is NOT a rate limit, i.e. callers that render a
 * structured empty state can keep their generic fallback for real failures.
 */
export function isRateLimitOnly(error: unknown): boolean {
	return isRateLimitError(error);
}
