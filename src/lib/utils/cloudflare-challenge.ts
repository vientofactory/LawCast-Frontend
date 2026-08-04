export const CF_RELOAD_GUARD_KEY = 'lawcast:cf-under-attack-reload-at';
export const CF_CHALLENGE_MARK_KEY = 'lawcast:cf-under-attack-last-detected-at';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isUnderAttackReloadEnabled(raw: string | null | undefined): boolean {
	return ENABLED_VALUES.has((raw || '').trim().toLowerCase());
}

export function isChallengeStatus(status: number): boolean {
	return status === 403 || status === 429 || status === 503 || status === 520;
}

export function isJsonContentType(contentType: string): boolean {
	const normalized = contentType.toLowerCase();
	return normalized.includes('application/json') || normalized.includes('+json');
}

export function isCloudflareChallengeHeader(response: Response): boolean {
	return (response.headers.get('cf-mitigated') || '').toLowerCase() === 'challenge';
}
