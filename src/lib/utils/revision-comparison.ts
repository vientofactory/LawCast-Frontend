import type { NoticeChangeEventItem } from '$lib/types/api';

export type RevisionSnapshot = Record<string, string | null>;
export type RevisionDiffItem = {
	fieldPath: string;
	fieldLabel: string;
	changeType: 'added' | 'removed' | 'modified' | 'unchanged';
	beforeValue: string | null;
	afterValue: string | null;
};
type DiffSegment = { text: string; kind: 'context' | 'removed' | 'added' };

const FIELD_LABELS: Record<string, string> = {
	num: '의안번호',
	contentId: '국회 의안 ID',
	subject: '법률안명',
	proposerCategory: '제안자 구분',
	committee: '소관위원회',
	proposalReason: '제안이유 및 주요내용',
	billNumber: '입법예고 의안번호',
	contentBillNumber: '입법예고 의안번호',
	proposer: '입법예고 제안자',
	contentProposer: '입법예고 제안자',
	proposalDate: '입법예고 제안일',
	contentProposalDate: '입법예고 제안일',
	contentCommittee: '입법예고 소관위원회',
	referralDate: '입법예고 회부일',
	contentReferralDate: '입법예고 회부일',
	noticePeriod: '입법예고 기간',
	contentNoticePeriod: '입법예고 기간',
	proposalSession: '입법예고 제안회기',
	contentProposalSession: '입법예고 제안회기',
	isDone: '처리 상태',
	lifecycleStatus: '보존 상태',
	sourceDeletedAt: '원문 삭제 감지 시각'
};

export function revisionFieldLabel(fieldPath: string): string {
	return FIELD_LABELS[fieldPath] ?? fieldPath;
}

export function formatRevisionValue(fieldPath: string, value: string | null): string {
	if (fieldPath === 'isDone') {
		if (value === 'true') return '입법예고 종료';
		if (value === 'false') return '입법예고 진행 중';
	}
	if (fieldPath === 'lifecycleStatus') {
		if (value === 'active') return '정상 수집';
		if (value === 'source_deleted') return '원문 삭제 감지 · 기록 보존';
		if (value === 'renumbered') return '의안번호 변경';
	}
	return value ?? '';
}

export function buildRevisionSnapshots(events: NoticeChangeEventItem[]) {
	const ascending = [...events].sort((a, b) => a.eventHeight - b.eventHeight);
	const snapshots: Record<number, RevisionSnapshot> = {};
	const current: RevisionSnapshot = {};
	// A field's first beforeValue also describes earlier available revisions.
	// This matters for legacy seeds and timelines that contain only a recent window.
	for (const event of ascending) {
		for (const detail of event.details) {
			if (!(detail.fieldPath in current)) current[detail.fieldPath] = detail.beforeValue;
		}
	}
	for (const event of ascending) {
		for (const detail of event.details) current[detail.fieldPath] = detail.afterValue;
		snapshots[event.eventHeight] = { ...current };
	}
	return snapshots;
}

export function compareRevisionSnapshots(
	before: RevisionSnapshot,
	after: RevisionSnapshot
): RevisionDiffItem[] {
	return [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.map((fieldPath): RevisionDiffItem => {
			const beforeValue = before[fieldPath] ?? null;
			const afterValue = after[fieldPath] ?? null;
			return {
				fieldPath,
				fieldLabel: revisionFieldLabel(fieldPath),
				changeType:
					beforeValue === afterValue
						? 'unchanged'
						: beforeValue === null
							? 'added'
							: afterValue === null
								? 'removed'
								: 'modified',
				beforeValue,
				afterValue
			};
		})
		.sort((a, b) => a.fieldLabel.localeCompare(b.fieldLabel, 'ko-KR'));
}

export function buildInlineDiffSegments(beforeValue: string, afterValue: string) {
	const beforeSegments: DiffSegment[] = [];
	const afterSegments: DiffSegment[] = [];
	function append(segments: DiffSegment[], text: string, kind: DiffSegment['kind']) {
		if (!text) return;
		const last = segments.at(-1);
		if (last?.kind === kind) last.text += text;
		else segments.push({ text, kind });
	}
	const beforeCharacters = Array.from(beforeValue);
	const afterCharacters = Array.from(afterValue);
	let prefix = 0;
	while (
		prefix < Math.min(beforeCharacters.length, afterCharacters.length) &&
		beforeCharacters[prefix] === afterCharacters[prefix]
	)
		prefix++;
	let suffix = 0;
	while (
		suffix < Math.min(beforeCharacters.length, afterCharacters.length) - prefix &&
		beforeCharacters.at(-suffix - 1) === afterCharacters.at(-suffix - 1)
	)
		suffix++;
	append(beforeSegments, beforeCharacters.slice(0, prefix).join(''), 'context');
	append(afterSegments, afterCharacters.slice(0, prefix).join(''), 'context');
	const before =
		beforeCharacters
			.slice(prefix, beforeCharacters.length - suffix)
			.join('')
			.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
	const after =
		afterCharacters
			.slice(prefix, afterCharacters.length - suffix)
			.join('')
			.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
	// Bound the LCS matrix for long legislative text; retain lossless fallback output.
	if ((before.length + 1) * (after.length + 1) <= 40_000) {
		const matrix = Array.from(
			{ length: before.length + 1 },
			() => new Uint16Array(after.length + 1)
		);
		for (let i = before.length - 1; i >= 0; i--) {
			for (let j = after.length - 1; j >= 0; j--) {
				matrix[i][j] =
					before[i] === after[j]
						? matrix[i + 1][j + 1] + 1
						: Math.max(matrix[i + 1][j], matrix[i][j + 1]);
			}
		}
		let i = 0;
		let j = 0;
		while (i < before.length || j < after.length) {
			if (i < before.length && j < after.length && before[i] === after[j]) {
				append(beforeSegments, before[i++], 'context');
				append(afterSegments, after[j++], 'context');
			} else if (
				i < before.length &&
				(j === after.length || matrix[i + 1][j] >= matrix[i][j + 1])
			) {
				append(beforeSegments, before[i++], 'removed');
			} else append(afterSegments, after[j++], 'added');
		}
	} else {
		append(beforeSegments, before.join(''), 'removed');
		append(afterSegments, after.join(''), 'added');
	}
	if (suffix) {
		append(beforeSegments, beforeCharacters.slice(-suffix).join(''), 'context');
		append(afterSegments, afterCharacters.slice(-suffix).join(''), 'context');
	}
	return { beforeSegments, afterSegments };
}
