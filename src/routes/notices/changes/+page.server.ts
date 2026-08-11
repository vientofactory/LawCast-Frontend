import { apiClient } from '$lib/api/client';
import { redirect } from '@sveltejs/kit';
import {
	isDiffchainUiMockEnabled,
	getMockRecentNoticeChangesResponse
} from '$lib/server/diffchain-ui-mock';
import type { PageServerLoad } from './$types';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

function parsePositiveInt(value: string | null): number | null {
	if (!value || value.trim().length === 0) {
		return null;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return null;
	}

	return parsed;
}

function parseIsoDate(value: string | null): string | null {
	if (!value || value.trim().length === 0) {
		return null;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const requestedPage = Number(url.searchParams.get('page') || '1');
	const requestedLimit = Number(url.searchParams.get('limit') || String(DEFAULT_PAGE_SIZE));
	const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
	const limit =
		Number.isFinite(requestedLimit) &&
		PAGE_SIZE_OPTIONS.includes(requestedLimit as (typeof PAGE_SIZE_OPTIONS)[number])
			? requestedLimit
			: DEFAULT_PAGE_SIZE;
	const search = (url.searchParams.get('search') || '').trim();
	const noticeNum = parsePositiveInt(url.searchParams.get('noticeNum'));
	const eventTypeRaw = (url.searchParams.get('eventType') || '').trim();
	const allowedEventTypes = ['updated', 'invalidated'] as const;
	const eventType = allowedEventTypes.includes(eventTypeRaw as (typeof allowedEventTypes)[number])
		? (eventTypeRaw as (typeof allowedEventTypes)[number])
		: undefined;
	const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
	const includeIsDoneChangesRaw = url.searchParams.get('includeIsDoneChanges');
	const includeIsDoneChanges =
		includeIsDoneChangesRaw === null
			? true
			: includeIsDoneChangesRaw === '1' || includeIsDoneChangesRaw === 'true';
	const fromEventId = parsePositiveInt(url.searchParams.get('fromEventId'));
	const toEventId = parsePositiveInt(url.searchParams.get('toEventId'));
	const fromDetectedAt = parseIsoDate(url.searchParams.get('fromDetectedAt'));
	const toDetectedAt = parseIsoDate(url.searchParams.get('toDetectedAt'));
	const shouldJumpToFirst =
		url.searchParams.get('jumpToFirst') === '1' || url.searchParams.get('jumpToFirst') === 'true';
	const isDigestContext =
		url.searchParams.get('digest') === '1' ||
		url.searchParams.get('digest') === 'true' ||
		fromEventId !== null ||
		toEventId !== null;

	if (isDiffchainUiMockEnabled()) {
		const summaryBase = getMockRecentNoticeChangesResponse({
			page: 1,
			limit: 1000,
			search,
			noticeNum: noticeNum ?? undefined,
			eventType,
			sortOrder,
			excludeIsDoneEvents: !includeIsDoneChanges
		});
		const changes = getMockRecentNoticeChangesResponse({
			page,
			limit,
			search,
			noticeNum: noticeNum ?? undefined,
			eventType,
			sortOrder,
			excludeIsDoneEvents: !includeIsDoneChanges
		});
		return {
			changes,
			summary: {
				comparableEventTotal: summaryBase.total,
				comparableNoticeCount: 4
			},
			filters: {
				search,
				noticeNum,
				eventType: eventType ?? null,
				sortOrder,
				includeIsDoneChanges
			},
			digestContext: {
				isDigestContext,
				fromEventId,
				toEventId,
				fromDetectedAt,
				toDetectedAt
			}
		};
	}

	if (isDigestContext && shouldJumpToFirst) {
		const firstDigestChanges = await apiClient.getRecentNoticeChanges(
			{
				page: 1,
				limit: 1,
				search,
				noticeNum: noticeNum ?? undefined,
				eventType,
				sortOrder,
				excludeLegacyGenesisSource: true,
				excludeIsDoneEvents: !includeIsDoneChanges,
				comparableOnly: true,
				fromEventId: fromEventId ?? undefined,
				toEventId: toEventId ?? undefined,
				fromDetectedAt: fromDetectedAt ?? undefined,
				toDetectedAt: toDetectedAt ?? undefined
			},
			fetch
		);

		const firstDigestItem = firstDigestChanges.items[0];
		if (firstDigestItem) {
			const anchorResult = await apiClient.getRecentNoticeChanges(
				{
					page,
					limit,
					search,
					noticeNum: noticeNum ?? undefined,
					eventType,
					sortOrder,
					excludeLegacyGenesisSource: true,
					excludeIsDoneEvents: !includeIsDoneChanges,
					comparableOnly: true,
					anchorEventId: firstDigestItem.id
				},
				fetch
			);

			const targetPage = anchorResult.anchorPage ?? 1;
			if (targetPage !== page) {
				const nextParams = new URLSearchParams(url.searchParams);
				nextParams.set('page', String(targetPage));
				nextParams.delete('jumpToFirst');
				throw redirect(307, `/notices/changes?${nextParams.toString()}`);
			}
		}
	}

	const [changes, summary] = await Promise.all([
		apiClient.getRecentNoticeChanges(
			{
				page,
				limit,
				search,
				noticeNum: noticeNum ?? undefined,
				eventType,
				sortOrder,
				excludeLegacyGenesisSource: true,
				excludeIsDoneEvents: !includeIsDoneChanges,
				comparableOnly: true,
				fromEventId: fromEventId ?? undefined,
				toEventId: toEventId ?? undefined,
				fromDetectedAt: fromDetectedAt ?? undefined,
				toDetectedAt: toDetectedAt ?? undefined
			},
			fetch
		),
		apiClient.getComparableNoticeChangesSummary(fetch)
	]);

	return {
		changes,
		summary,
		filters: {
			search,
			noticeNum,
			eventType: eventType ?? null,
			sortOrder,
			includeIsDoneChanges
		},
		digestContext: {
			isDigestContext,
			fromEventId,
			toEventId,
			fromDetectedAt,
			toDetectedAt
		}
	};
};
