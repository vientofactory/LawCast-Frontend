import { apiClient } from '$lib/api/client';
import type { ProposalStatisticsData, ProposalStatisticsGranularity } from '$lib/types/api';
import type { PageServerLoad } from './$types';

const FALLBACK: ProposalStatisticsData = {
	granularity: 'daily',
	startDate: null,
	endDate: null,
	totalCount: 0,
	buckets: []
};

export const load: PageServerLoad = async ({ fetch, url }) => {
	const granularity =
		(url.searchParams.get('granularity') as ProposalStatisticsGranularity) || 'daily';
	const startDate = url.searchParams.get('startDate') || undefined;
	const endDate = url.searchParams.get('endDate') || undefined;

	try {
		const statistics = await apiClient.getProposalStatistics(
			{ granularity, startDate, endDate },
			fetch
		);
		return {
			statistics,
			fetchedAt: new Date().toISOString()
		};
	} catch (err) {
		console.error('Failed to load proposal statistics:', err);
		return {
			statistics: { ...FALLBACK, granularity },
			fetchedAt: new Date().toISOString(),
			error: '발의 통계를 불러오지 못했습니다.'
		};
	}
};
