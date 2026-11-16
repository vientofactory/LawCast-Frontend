import { solvePow, type HashGuardClient } from 'hashguard-client';

export type PowStatus = {
	phase: 'assess' | 'warmup' | 'solve' | 'verify' | 'done';
	message: string;
	attempts?: number;
	difficultyBits?: number;
	hashRate?: number;
	estimatedRemainingMs?: number;
	attemptProgress?: number;
};

/** Shared adaptive flow for workers and browsers without Worker support. */
export async function executeAdaptivePow(
	client: HashGuardClient,
	context: string,
	onStatus?: (status: PowStatus) => void,
	warmup: () => Promise<boolean> = async () => false
): Promise<string> {
	onStatus?.({ phase: 'assess', message: '요청의 보안 상태를 확인하고 있어요...' });
	const assessment = await client.assessRequest(context);
	let proof: string;
	if (assessment.action === 'allow') {
		proof = assessment.verification.proofToken;
	} else if (assessment.action === 'challenge') {
		const challenge = assessment.challenge;
		onStatus?.({ phase: 'warmup', message: '추가 보안 검증을 준비하고 있어요...' });
		await warmup();
		onStatus?.({
			phase: 'solve',
			message: '작업증명 해시를 계산하는 중입니다...',
			difficultyBits: challenge.difficultyBits
		});
		const solved = solvePow(challenge.challengeId, challenge.seed, challenge.target, {
			difficultyBits: challenge.difficultyBits,
			progressInterval: 50_000,
			onEstimate: (estimate) => {
				if (estimate.phase !== 'progress') return;
				onStatus?.({
					phase: 'solve',
					message: '작업증명 해시를 계산하는 중입니다...',
					attempts: estimate.attempts,
					difficultyBits: challenge.difficultyBits,
					hashRate: estimate.hashRate,
					estimatedRemainingMs: estimate.estimatedRemainingMs ?? undefined,
					attemptProgress: estimate.attemptProgress
				});
			}
		});
		onStatus?.({
			phase: 'verify',
			message: '연산 결과를 서버에서 검증하고 있어요...',
			attempts: solved.attempts,
			difficultyBits: challenge.difficultyBits
		});
		proof = (await client.verifyChallenge(challenge.challengeId, solved.nonce, solved.solveTimeMs))
			.proofToken;
	} else {
		throw new Error('보안 검증 응답을 확인할 수 없습니다.');
	}
	if (!proof) throw new Error('보안 검증에 실패했습니다.');
	onStatus?.({ phase: 'done', message: '보안 검증이 완료되었습니다.' });
	return proof;
}
