/**
 * Canonical National Assembly opinion-submission page.
 * Mirrors the base URL the backend keeps for opinion participation
 * (backend/src/modules/notification/notification.service.ts).
 */
const OPINION_SUBMISSION_PAGE_URL = 'https://pal.assembly.go.kr/napal/lgsltpa/lgsltpaOpn/list.do';

// Only this exact host is eligible for rewriting; lookalike subdomains or
// suffix domains (pal.assembly.go.kr.evil.com) must never match.
const ASSEMBLY_HOSTNAME = 'pal.assembly.go.kr';

// Bill identifier shared by all pal.assembly.go.kr page URLs.
const OPINION_ID_PARAM = 'lgsltPaId';

/**
 * Returns the opinion-submission page URL for a notice source link.
 *
 * Only pal.assembly.go.kr links carrying an lgsltPaId query param are
 * rewritten (e.g. lgsltpaOngoing/view.do -> lgsltpaOpn/list.do with the same
 * id). Every other URL — other domains, missing or empty ids, unparseable
 * input — is returned unchanged so callers can use this as a drop-in for the
 * raw notice link.
 */
export function buildOpinionSubmissionUrl(link: string | null | undefined): string {
	if (!link) {
		return link ?? '';
	}

	let parsed: URL;
	try {
		parsed = new URL(link);
	} catch {
		return link;
	}

	if (parsed.hostname !== ASSEMBLY_HOSTNAME) {
		return link;
	}

	const opinionId = parsed.searchParams.get(OPINION_ID_PARAM);
	if (!opinionId) {
		return link;
	}

	return `${OPINION_SUBMISSION_PAGE_URL}?${OPINION_ID_PARAM}=${encodeURIComponent(opinionId)}`;
}
