import type { NoticeChangeEventItem } from '$lib/types/api';

export type RevisionSnapshot = Record<string, string | null>;
export type RevisionDiffItem = {
	fieldPath: string;
	fieldLabel: string;
	changeType: 'added' | 'removed' | 'modified' | 'unchanged';
	beforeValue: string | null;
	afterValue: string | null;
};
export { buildInlineDiffSegments } from './revision-text-diff';

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
