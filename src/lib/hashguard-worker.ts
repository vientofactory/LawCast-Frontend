import { browser } from '$app/env';
import * as env from '$app/env/public';
import HashGuardPowWorker from '#lib/workers/hashguardPow.worker?worker';
import type { PowStatus } from '#lib/hashguard-flow.ts';
export type { PowStatus } from '#lib/hashguard-flow.ts';

const HASHGUARD_URL = env.PUBLIC_HASHGUARD_URL || 'https://hashguard.viento.me';

type WarmupRequest = {
	requestId: number;
	command: 'warmup';
	baseUrl: string;
};

type ExecuteRequest = {
	requestId: number;
	command: 'execute';
	context: string;
	baseUrl: string;
};

type WorkerRequest = WarmupRequest | ExecuteRequest;

type WorkerRequestPayload =
	| {
			command: 'warmup';
			baseUrl: string;
	  }
	| {
			command: 'execute';
			context: string;
			baseUrl: string;
	  };

type WorkerResponse = {
	requestId: number;
	ok: boolean;
	wasmReady?: boolean;
	proof?: string;
	error?: string;
	status?: number;
	code?: string;
};

type WorkerStatusEvent = {
	requestId: number;
	type: 'status';
	phase: PowStatus['phase'];
	message: string;
	attempts?: number;
	difficultyBits?: number;
	hashRate?: number;
	estimatedRemainingMs?: number;
	attemptProgress?: number;
};

type WorkerResultEvent = {
	requestId: number;
	type: 'result';
	response: WorkerResponse;
};

type WorkerEvent = WorkerStatusEvent | WorkerResultEvent;

type PendingRequest = {
	resolve: (value: WorkerResponse) => void;
	reject: (reason?: unknown) => void;
	onStatus?: (status: PowStatus) => void;
};

let worker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function rejectAllPendingRequests(reason: Error): void {
	for (const { reject } of pendingRequests.values()) {
		reject(reason);
	}
	pendingRequests.clear();
}

function ensureWorker(): Worker {
	if (!browser) {
		throw new Error('브라우저 환경에서만 HashGuard 워커를 사용할 수 있습니다.');
	}

	if (worker) {
		return worker;
	}

	worker = new HashGuardPowWorker();
	worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
		const data = event.data;
		const pending = pendingRequests.get(data.requestId);

		if (!pending) {
			return;
		}

		if (data.type === 'status') {
			pending.onStatus?.({
				phase: data.phase,
				message: data.message,
				attempts: data.attempts,
				difficultyBits: data.difficultyBits,
				hashRate: data.hashRate,
				estimatedRemainingMs: data.estimatedRemainingMs,
				attemptProgress: data.attemptProgress
			});
			return;
		}

		pendingRequests.delete(data.requestId);
		pending.resolve(data.response);
	};

	worker.onerror = () => {
		worker?.terminate();
		worker = null;
		rejectAllPendingRequests(new Error('HashGuard 워커 실행 중 오류가 발생했습니다.'));
	};

	return worker;
}

function sendWorkerRequest(
	request: WorkerRequestPayload,
	onStatus?: (status: PowStatus) => void
): Promise<WorkerResponse> {
	const activeWorker = ensureWorker();
	const requestId = nextRequestId++;

	return new Promise<WorkerResponse>((resolve, reject) => {
		pendingRequests.set(requestId, { resolve, reject, onStatus });
		const requestWithId: WorkerRequest = { ...request, requestId };
		activeWorker.postMessage(requestWithId);
	});
}

async function warmupOnMainThread(): Promise<boolean> {
	const { warmupHashGuardWasm } = await import('#lib/hashguard.ts');
	return warmupHashGuardWasm();
}

async function executeOnMainThread(
	context: string,
	onStatus?: (status: PowStatus) => void
): Promise<string> {
	const { executeAdaptivePow } = await import('#lib/hashguard-flow.ts');
	const { getHashGuardClient, warmupHashGuardWasm } = await import('#lib/hashguard.ts');
	return executeAdaptivePow(getHashGuardClient(), context, onStatus, warmupHashGuardWasm);
}

export async function warmupHashGuardWorker(): Promise<boolean> {
	if (!browser) {
		return false;
	}

	if (typeof Worker === 'undefined') {
		return warmupOnMainThread();
	}

	const response = await sendWorkerRequest({ command: 'warmup', baseUrl: HASHGUARD_URL });
	if (!response.ok) {
		throw new Error(response.error || 'HashGuard 워커 초기화에 실패했습니다.');
	}

	return Boolean(response.wasmReady);
}

export async function executePowInWorker(
	context: string,
	onStatus?: (status: PowStatus) => void
): Promise<string> {
	if (!browser) {
		throw new Error('브라우저 환경에서만 작업증명 연산을 수행할 수 있습니다.');
	}

	if (typeof Worker === 'undefined') {
		return executeOnMainThread(context, onStatus);
	}

	const response = await sendWorkerRequest(
		{ command: 'execute', context, baseUrl: HASHGUARD_URL },
		onStatus
	);
	if (!response.ok || !response.proof) {
		throw Object.assign(new Error(response.error || '보안 검증에 실패했습니다.'), {
			status: response.status,
			code: response.code
		});
	}

	return response.proof;
}
