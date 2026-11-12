import { getFailureStatus } from '#lib/utils/request-failure.ts';

/** Preserve rendered recovery UI without presenting its response as a cacheable success. */
export function markResponseFailure(locals: App.Locals, error?: unknown) {
	const status = getFailureStatus(error);
	locals.responseFailureStatus = status && status >= 400 ? status : 503;
}
