import { error } from '@sveltejs/kit';
import initial from './legal-notices/2026-11-26.1.json';
import defenses from './legal-notices/2026-11-26.2.json';
import grounded from './legal-notices/2026-11-26.3.json';
import openSource from './legal-notices/2026-11-27.1.json';
import type { LegalNotice, LegalNoticePageData } from '#lib/types/legal-notice.ts';

// Append new snapshots; never overwrite an existing public version.
// Static imports work on Cloudflare without runtime filesystem access.
const notices: readonly LegalNotice[] = [initial, defenses, grounded, openSource];
const current = notices[notices.length - 1];

export function loadLegalNotice(version?: string): LegalNoticePageData {
	const notice = version === undefined ? current : notices.find((entry) => entry.id === version);
	if (!notice) error(404, '요청한 법적 고지 판본을 찾을 수 없습니다.');
	const isCurrent = notice.id === current.id;
	return {
		notice,
		versions: [...notices].reverse().map(({ id, recordedOn, changeSummary }) => ({
			id,
			recordedOn,
			changeSummary
		})),
		isCurrent,
		canonicalPath: isCurrent ? '/legal' : `/legal/versions/${notice.id}`
	};
}
