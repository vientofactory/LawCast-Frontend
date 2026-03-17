import { HashGuardClient, initHashGuardWasm, solvePow } from 'hashguard-client';

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
};

type PowStatusPhase = 'warmup' | 'issue' | 'solve' | 'verify' | 'done';

type WorkerStatusEvent = {
	requestId: number;
	type: 'status';
	phase: PowStatusPhase;
	message: string;
	attempts?: number;
	difficultyBits?: number;
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

		postStatus(requestId, 'warmup', 'WASM 가속 엔진을 준비하고 있어요...');
		await warmupWasm();
		const client = getClient(request.baseUrl);

		postStatus(requestId, 'issue', '서버에 보안 챌린지를 요청하고 있어요...');
		const challenge = await client.issueChallenge(request.context);

		let lastReportedAttempts = 0;
		postStatus(requestId, 'solve', '작업증명 해시를 계산하는 중입니다...', {
			difficultyBits: challenge.difficultyBits
		});
		const solveResult = solvePow(challenge.challengeId, challenge.seed, challenge.target, {
			onProgress: (attempts) => {
				if (attempts - lastReportedAttempts < 100_000) {
					return;
				}
				lastReportedAttempts = attempts;
				postStatus(requestId, 'solve', '작업증명 해시를 계산하는 중입니다...', {
					attempts,
					difficultyBits: challenge.difficultyBits
				});
			}
		});

		postStatus(requestId, 'verify', '연산 결과를 서버에서 검증하고 있어요...', {
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

		postStatus(requestId, 'done', '보안 검증이 완료되었습니다.', {
			attempts: solveResult.attempts,
			difficultyBits: challenge.difficultyBits
		});
		postResult(requestId, { requestId, ok: true, proof });
	} catch (error: unknown) {
		postResult(requestId, {
			requestId,
			ok: false,
			error: error instanceof Error ? error.message : '예상치 못한 오류가 발생했습니다.'
		});
	}
};

export {};
