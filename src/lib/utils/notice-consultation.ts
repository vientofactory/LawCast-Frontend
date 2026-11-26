import { buildNoticeDeadline, getKstToday } from './notice-deadline.util.ts';

export interface ConsultationInput {
	contentId?: string | null;
	link?: string;
	isDone?: boolean | null;
	noticePeriod?: string | null;
}

export type ConsultationKind = 'pre_notice' | 'open' | 'ended' | 'scheduled' | 'unknown';

/** Opinion collection is independent of parliamentary bill disposition. */
export function getNoticeConsultation(notice: ConsultationInput): {
	kind: ConsultationKind;
	label: string;
} {
	let hasTarget = Boolean(notice.contentId?.trim());
	// Older list responses may omit contentId; only a real PAL notice URL is evidence.
	if (notice.contentId === undefined && notice.link) {
		try {
			const url = new URL(notice.link);
			hasTarget =
				url.hostname === 'pal.assembly.go.kr' && Boolean(url.searchParams.get('lgsltPaId')?.trim());
		} catch {
			// Malformed source URLs do not establish an opinion target.
		}
	}
	if (!hasTarget) {
		return notice.contentId !== undefined
			? { kind: 'pre_notice', label: '입법예고 전' }
			: { kind: 'unknown', label: '의견수렴 상태 미확인' };
	}
	const deadline = buildNoticeDeadline(notice.noticePeriod, notice.isDone);
	if (notice.isDone === true || deadline.kind === 'ended') {
		return { kind: 'ended', label: '의견수렴 종료' };
	}
	const start = notice.noticePeriod?.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
	if (
		start &&
		`${start[1]}-${start[2].padStart(2, '0')}-${start[3].padStart(2, '0')}` > getKstToday()
	) {
		return { kind: 'scheduled', label: '의견수렴 예정' };
	}
	return notice.isDone === false || deadline.kind === 'open'
		? { kind: 'open', label: '의견수렴 중' }
		: { kind: 'unknown', label: '의견수렴 상태 미확인' };
}
