export interface PowStatusLike {
	message: string;
	attempts?: number;
	difficultyBits?: number;
	hashRate?: number;
	estimatedRemainingMs?: number;
}

export interface PowDisplayState {
	message: string;
	attempts: number | null;
	difficultyBits: number | null;
	hashRate: number | null;
	estimatedRemainingMs: number | null;
}

export function createPowDisplayState(message = ''): PowDisplayState {
	return {
		message,
		attempts: null,
		difficultyBits: null,
		hashRate: null,
		estimatedRemainingMs: null
	};
}

export function applyPowStatus(current: PowDisplayState, status: PowStatusLike): PowDisplayState {
	return {
		message: status.message,
		attempts: status.attempts ?? current.attempts,
		difficultyBits: status.difficultyBits ?? current.difficultyBits,
		hashRate: status.hashRate ?? current.hashRate,
		estimatedRemainingMs: status.estimatedRemainingMs ?? current.estimatedRemainingMs
	};
}

export function formatPowHashRate(rate: number): string {
	if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(1)} MH/s`;
	if (rate >= 1_000) return `${Math.round(rate / 1_000).toLocaleString()} kH/s`;
	return `${Math.round(rate).toLocaleString()} H/s`;
}

export function formatPowRemainingTime(ms: number): string {
	if (ms >= 60_000) return `약 ${Math.ceil(ms / 60_000)}분`;
	if (ms >= 10_000) return `약 ${Math.ceil(ms / 1_000)}초`;
	return '잠시 후 완료';
}
