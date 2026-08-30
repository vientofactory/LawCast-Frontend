import { apiClient } from '$lib/api/client';
import type { CrawlingTransparencyData } from '$lib/types/api';
import type { PageServerLoad } from './$types';
const FALLBACK: CrawlingTransparencyData = {
	noticeSources: [
		{
			id: 'pal',
			name: '국회 입법예고 게시판',
			url: 'https://pal.assembly.go.kr',
			description: '국회에서 발의된 법률안과 입법예고 정보를 수집합니다.',
			noticeCount: 0,
			intervalMs: 600000,
			intervalLabel: '매 10분'
		},
		{
			id: 'nsm',
			name: '국민참여입법센터 입법진행현황',
			url: 'https://opinion.lawmaking.go.kr',
			description: '국민참여입법센터의 입법진행현황(국회입법현황)을 수집합니다.',
			noticeCount: 0,
			intervalMs: 1200000,
			intervalLabel: '매 20분'
		}
	],
	collection: {
		totalNotices: 0,
		byLifecycle: {},
		bySource: {}
	},
	changeTracking: {
		totalEvents: 0,
		byType: {}
	},
	schedules: [],
	transferFlow: {
		description:
			'국민참여입법센터의 입법진행현황에서 국회입법현황으로 이관된 의안이 있으면, 크롤러가 이를 자동으로 감지하여 동기화합니다.',
		nsmToPalIndicator:
			'국회입법현황에서 의안으로 등록된 경우, 크롤러가 자동으로 동기화하여 관리합니다.'
	}
};

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const transparency = await apiClient.getCrawlingTransparency(fetch);
		return {
			transparency,
			fetchedAt: new Date().toISOString()
		};
	} catch (err) {
		console.error('Failed to load crawling transparency data:', err);
		return {
			transparency: FALLBACK,
			fetchedAt: new Date().toISOString(),
			error: '투명성 정보를 불러오지 못했습니다.'
		};
	}
};
