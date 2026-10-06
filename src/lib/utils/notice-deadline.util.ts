/**
 * Notice-period parsing and deadline (D-day) display helpers.
 * The API only exposes the notice period as a raw string like
 * "2026-06-14 ~ 2026-06-28", so the end date is parsed client-side.
 * All calendar math is anchored at KST, the notice period's own timezone.
 */

export type NoticeDeadline =
	| { kind: 'none' }
	| { kind: 'open'; label: string; endDate: string; daysLeft: number }
	| { kind: 'ended'; label: string; endDate: string };

const DATE_TOKEN_PATTERN = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/g;
const KST_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

/** Today's calendar date in KST, formatted as YYYY-MM-DD. */
export function getKstToday(): string {
	const now = new Date(Date.now() + KST_UTC_OFFSET_MS);
	return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

/**
 * Extracts the period end date from a raw notice-period string.
 * The end date is the LAST date token ("2026-06-14 ~ 2026-06-28" style).
 */
export function parseNoticePeriodEnd(noticePeriod: string | null | undefined): string | null {
	if (!noticePeriod) {
		return null;
	}

	const matches = [...noticePeriod.matchAll(DATE_TOKEN_PATTERN)];
	if (matches.length === 0) {
		return null;
	}

	const last = matches[matches.length - 1];
	return `${last[1]}-${pad2(Number(last[2]))}-${pad2(Number(last[3]))}`;
}

function calendarDaysBetween(fromDate: string, toDate: string): number {
	const fromMs = Date.parse(`${fromDate}T00:00:00+09:00`);
	const toMs = Date.parse(`${toDate}T00:00:00+09:00`);
	return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

/**
 * Builds the deadline chip payload from the raw notice period and done state.
 * - not done, end date in the future: "마감 D-3" (0 → "마감 D-Day")
 * - done or end date already passed: "종료(2026-06-28)"
 * - unparseable period: no chip
 */
export function buildNoticeDeadline(
	noticePeriod: string | null | undefined,
	isDone: boolean | null | undefined
): NoticeDeadline {
	const endDate = parseNoticePeriodEnd(noticePeriod);
	if (!endDate) {
		return { kind: 'none' };
	}

	const daysLeft = calendarDaysBetween(getKstToday(), endDate);
	if (isDone === true || daysLeft < 0) {
		return { kind: 'ended', label: `종료(${endDate})`, endDate };
	}

	const label = daysLeft === 0 ? '마감 D-Day' : `마감 D-${daysLeft}`;
	return { kind: 'open', label, endDate, daysLeft };
}

/** "2026-06-28 마감 (D-3)" suffix shown next to the raw notice-period value. */
export function formatNoticeDeadlineSuffix(deadline: NoticeDeadline): string {
	if (deadline.kind === 'none') {
		return '';
	}

	if (deadline.kind === 'open') {
		const dday = deadline.daysLeft === 0 ? 'D-Day' : `D-${deadline.daysLeft}`;
		return `${deadline.endDate} 마감 (${dday})`;
	}

	return `${deadline.endDate} 마감 (종료)`;
}
