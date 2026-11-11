export const SEARCH_TRACE_HEADER = 'x-lawcast-search-trace';
export const SEARCH_TIMING_HEADER = 'x-lawcast-search-timing';

const DENSE_STAGES = [
	['embedding', '질의 임베딩'],
	['faiss', 'FAISS 조회·정렬'],
	['classification', '관련도 분류']
] as const;

const EMBEDDING_STAGES = [
	['tokenization', '토큰화'],
	['model', '모델 실행'],
	['cpuConversion', 'CPU 벡터 변환']
] as const;

interface SearchPhases {
	denseMs: number;
	annotateMs: number;
	totalMs: number;
	admissionMs?: number;
	rankWaitMs?: number;
	denseStages?: unknown;
}

interface SidecarTiming {
	transport?: 'http' | 'grpc';
	grpcCode?: number;
	path: '/health' | '/search';
	chunkK?: number;
	startMs?: number;
	roundTripMs?: number;
	status?: number;
	outcome: 'pending' | 'ok' | 'error';
	timings?: SearchPhases;
}

const GRPC_CODES = [
	'OK',
	'CANCELLED',
	'UNKNOWN',
	'INVALID_ARGUMENT',
	'DEADLINE_EXCEEDED',
	'NOT_FOUND',
	'ALREADY_EXISTS',
	'PERMISSION_DENIED',
	'RESOURCE_EXHAUSTED',
	'FAILED_PRECONDITION',
	'ABORTED',
	'OUT_OF_RANGE',
	'UNIMPLEMENTED',
	'INTERNAL',
	'UNAVAILABLE',
	'DATA_LOSS',
	'UNAUTHENTICATED'
] as const;

export function sidecarOperation(call: SidecarTiming) {
	if (call.transport === 'grpc') return `gRPC ${call.path === '/health' ? 'GetHealth' : 'Search'}`;
	if (call.transport === 'http') return `HTTP ${call.path}`;
	return call.path;
}

export function sidecarStatus(call: SidecarTiming) {
	if (call.transport === 'grpc' && call.grpcCode !== undefined)
		return `gRPC ${GRPC_CODES[call.grpcCode]} (${call.grpcCode})`;
	if (call.status !== undefined)
		return call.transport === 'http' ? `HTTP ${call.status}` : `상태 ${call.status} · 전송 미기록`;
}

interface BackendTiming {
	backendMs: number;
	sidecarCalls: SidecarTiming[];
	omittedCalls: number;
}

export interface SearchTiming {
	traceId: string;
	path: string;
	query: string;
	recordedAt: number;
	sveltekitMs: number;
	fetchStartedMs?: number;
	headersReceivedMs?: number;
	status?: number;
	outcome: 'success' | 'error' | 'timeout';
	backend?: BackendTiming;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const isDuration = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value);

function readStages(
	value: unknown,
	definitions: ReadonlyArray<readonly [string, string]>,
	parentMs: number
) {
	if (!isRecord(value)) return undefined;
	const stages = [];
	let previousEnd = 0;
	for (const [key, label] of definitions) {
		const stage = value[key];
		if (!isRecord(stage) || !isDuration(stage.startMs) || !isDuration(stage.durationMs))
			return undefined;
		const { startMs, durationMs } = stage;
		const end = startMs + durationMs;
		if (startMs + 1e-6 < previousEnd || end > parentMs + 1e-6) return undefined;
		stages.push({ key, label, startMs, durationMs });
		previousEnd = end;
	}
	return stages;
}

export function readDenseStages(timings?: SearchPhases) {
	if (!timings || !isRecord(timings.denseStages)) return undefined;
	const { denseStages, denseMs } = timings;
	const stages = readStages(denseStages, DENSE_STAGES, denseMs);
	return stages?.map((stage) => ({
		...stage,
		children:
			stage.key === 'embedding'
				? readStages(denseStages.embeddingStages, EMBEDDING_STAGES, stage.durationMs)
				: undefined
	}));
}

export function readWorkerWaits(timings?: SearchPhases) {
	if (!timings) return [];
	return [
		{ key: 'admission', label: '임베딩 워커 대기', ms: timings.admissionMs },
		{ key: 'rank-wait', label: '순위 워커 대기', ms: timings.rankWaitMs }
	].flatMap(({ key, label, ms }) =>
		isDuration(ms) && ms <= timings.denseMs ? [{ key, label, durationMs: ms }] : []
	);
}

function isSidecarTiming(value: unknown): value is SidecarTiming {
	if (!isRecord(value)) return false;
	const { path, transport, grpcCode, chunkK, startMs, status, outcome, roundTripMs, timings } =
		value;
	return (
		(path === '/health' || path === '/search') &&
		(transport === undefined || transport === 'http' || transport === 'grpc') &&
		(grpcCode === undefined ||
			(transport === 'grpc' &&
				isInteger(grpcCode) &&
				grpcCode >= 0 &&
				grpcCode < GRPC_CODES.length)) &&
		(transport !== 'grpc' || status === undefined) &&
		(chunkK === undefined || (isInteger(chunkK) && chunkK > 0)) &&
		(startMs === undefined || isDuration(startMs)) &&
		(status === undefined || (isInteger(status) && status >= 100 && status <= 599)) &&
		(outcome === 'ok' || outcome === 'error' || outcome === 'pending') &&
		(roundTripMs === undefined || isDuration(roundTripMs)) &&
		(timings === undefined ||
			(isRecord(timings) &&
				isDuration(timings.denseMs) &&
				isDuration(timings.annotateMs) &&
				isDuration(timings.totalMs)))
	);
}

function isBackendTiming(value: unknown): value is BackendTiming {
	return (
		isRecord(value) &&
		isDuration(value.backendMs) &&
		Array.isArray(value.sidecarCalls) &&
		value.sidecarCalls.length <= 12 &&
		value.sidecarCalls.every(isSidecarTiming) &&
		isInteger(value.omittedCalls) &&
		value.omittedCalls >= 0
	);
}

export function isSearchTiming(value: unknown): value is SearchTiming {
	return (
		isRecord(value) &&
		typeof value.traceId === 'string' &&
		typeof value.path === 'string' &&
		typeof value.query === 'string' &&
		isInteger(value.recordedAt) &&
		value.recordedAt >= 0 &&
		isDuration(value.sveltekitMs) &&
		(value.fetchStartedMs === undefined || isDuration(value.fetchStartedMs)) &&
		(value.headersReceivedMs === undefined || isDuration(value.headersReceivedMs)) &&
		(value.status === undefined || isInteger(value.status)) &&
		(value.outcome === 'success' || value.outcome === 'error' || value.outcome === 'timeout') &&
		(value.backend === undefined || isBackendTiming(value.backend))
	);
}

export function parseBackendTiming(
	header: string | null,
	traceId: string
): BackendTiming | undefined {
	if (!header || header.length > 4096) return;
	try {
		const data: unknown = JSON.parse(header);
		if (!isRecord(data) || data.traceId !== traceId) return;
		if (isBackendTiming(data)) {
			const { backendMs, sidecarCalls, omittedCalls } = data;
			return { backendMs, sidecarCalls, omittedCalls };
		}
	} catch {
		// Debug metadata is optional and must not affect search results.
	}
}
