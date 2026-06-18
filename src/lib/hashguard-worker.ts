import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import HashGuardPowWorker from '$lib/workers/hashguardPow.worker?worker';
import type { Challenge } from 'hashguard-client';

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
};

type PowStatusPhase = 'warmup' | 'issue' | 'solve' | 'verify' | 'done';

export type PowStatus = {
	phase: PowStatusPhase;
	message: string;
	attempts?: number;
	difficultyBits?: number;
	hashRate?: number;
	estimatedRemainingMs?: number;
	attemptProgress?: number;
};

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
	const { warmupHashGuardWasm } = await import('$lib/hashguard');
	return warmupHashGuardWasm();
}

function notifyStatus(
	onStatus: ((status: PowStatus) => void) | undefined,
	phase: PowStatusPhase,
	message: string,
	extra: Omit<PowStatus, 'phase' | 'message'> = {}
): void {
	onStatus?.({ phase, message, ...extra });
}

async function solveChallengeOnMainThread(
	challenge: Challenge,
	onStatus?: (status: PowStatus) => void
) {
	const { solvePow } = await import('hashguard-client');
	return solvePow(challenge.challengeId, challenge.seed, challenge.target, {
		difficultyBits: challenge.difficultyBits,
		progressInterval: 50000,
		onEstimate: (estimate_1) => {
			if (estimate_1.phase !== 'progress') return;
			notifyStatus(onStatus, 'solve', '잠시만 기다려주세요, 작업증명 해시를 계산하는 중입니다...', {
				attempts: estimate_1.attempts,
				difficultyBits: challenge.difficultyBits,
				hashRate: estimate_1.hashRate,
				estimatedRemainingMs: estimate_1.estimatedRemainingMs ?? undefined,
				attemptProgress: estimate_1.attemptProgress
			});
		}
	});
}

async function executeOnMainThread(
	context: string,
	onStatus?: (status: PowStatus) => void
): Promise<string> {
	const { getHashGuardClient, warmupHashGuardWasm } = await import('$lib/hashguard');
	notifyStatus(onStatus, 'warmup', 'WASM 가속 엔진을 준비하고 있어요...');
	await warmupHashGuardWasm();
	const client = getHashGuardClient();

	notifyStatus(onStatus, 'issue', '서버에 보안 챌린지를 요청하고 있어요...');
	const challenge = await client.issueChallenge(context);

	notifyStatus(onStatus, 'solve', '잠시만 기다려주세요, 작업증명 해시를 계산하는 중입니다...', {
		difficultyBits: challenge.difficultyBits
	});
	const solveResult = await solveChallengeOnMainThread(challenge, onStatus);

	notifyStatus(onStatus, 'verify', '연산 결과를 서버에서 검증하고 있어요...', {
		attempts: solveResult.attempts,
		difficultyBits: challenge.difficultyBits
	});
	const verification = await client.verifyChallenge(
		challenge.challengeId,
		solveResult.nonce,
		solveResult.solveTimeMs
	);

	const proof = verification.proofToken;

	if (!proof) {
		throw new Error('보안 검증에 실패했습니다.');
	}

	notifyStatus(onStatus, 'done', '보안 검증이 완료되었습니다.', {
		attempts: solveResult.attempts,
		difficultyBits: challenge.difficultyBits
	});

	return proof;
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
		throw new Error(response.error || '보안 검증에 실패했습니다.');
	}

	return response.proof;
}
