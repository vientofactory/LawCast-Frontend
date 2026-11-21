import { HashGuardError, HashGuardClient, initHashGuardWasm } from 'hashguard-client';

import { executeAdaptivePow, type PowStatus } from '../hashguard-flow';

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

type WorkerResponse = {
	requestId: number;
	ok: boolean;
	wasmReady?: boolean;
	proof?: string;
	error?: string;
	status?: number;
	code?: string;
};

type PowStatusPhase = PowStatus['phase'];

type WorkerStatusEvent = {
	requestId: number;
	type: 'status';
	phase: PowStatusPhase;
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

const DEFAULT_HASHGUARD_URL = 'https://hashguard.viento.me';

let client: HashGuardClient | null = null;
let clientBaseUrl = '';

let wasmInitPromise: Promise<boolean> | null = null;

function postStatus(
	requestId: number,
	phase: PowStatusPhase,
	message: string,
	extra: Omit<WorkerStatusEvent, 'requestId' | 'type' | 'phase' | 'message'> = {}
): void {
	const event: WorkerStatusEvent = {
		requestId,
		type: 'status',
		phase,
		message,
		...extra
	};
	self.postMessage(event satisfies WorkerEvent);
}

function postResult(requestId: number, response: WorkerResponse): void {
	const event: WorkerResultEvent = {
		requestId,
		type: 'result',
		response
	};
	self.postMessage(event satisfies WorkerEvent);
}

function warmupWasm(): Promise<boolean> {
	if (!wasmInitPromise) {
		wasmInitPromise = initHashGuardWasm().catch(() => false);
	}

	return wasmInitPromise;
}

function getClient(baseUrl: string): HashGuardClient {
	const normalizedBaseUrl = baseUrl || DEFAULT_HASHGUARD_URL;

	if (!client || clientBaseUrl !== normalizedBaseUrl) {
		client = new HashGuardClient({
			baseUrl: normalizedBaseUrl
		});
		clientBaseUrl = normalizedBaseUrl;
	}

	return client;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;
	const { requestId } = request;

	try {
		if (request.command === 'warmup') {
			postStatus(requestId, 'warmup', 'WASM 가속 엔진을 준비하고 있어요...');
			const wasmReady = await warmupWasm();
			postResult(requestId, { requestId, ok: true, wasmReady });
			return;
		}

		const proof = await executeAdaptivePow(
			getClient(request.baseUrl),
			request.context,
			(status) => postStatus(requestId, status.phase, status.message, status),
			warmupWasm
		);
		postResult(requestId, { requestId, ok: true, proof });
	} catch (error: unknown) {
		postResult(requestId, {
			requestId,
			ok: false,
			status: error instanceof HashGuardError ? error.status : undefined,
			code: error instanceof HashGuardError ? error.code : undefined,
			error: error instanceof Error ? error.message : '예상치 못한 오류가 발생했습니다.'
		});
	}
};

export {};
