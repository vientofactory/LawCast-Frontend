import { apiClient } from '$lib/api/client';
import type { CrawlingTransparencyData } from '$lib/types/api';
import {
	isDiffchainUiMockEnabled,
	getMockCrawlingTransparencyData
} from '$lib/server/diffchain-ui-mock';
import { toLoadErrorPayload } from '$lib/server/load-error';
import type { PageServerLoad } from './$types';
// Fallback mirrors the backend template in
// `backend/src/modules/ollama/ai-summary-prompt.util.ts` for offline renders.
const FALLBACK_AI_SUMMARY: NonNullable<CrawlingTransparencyData['aiSummary']> = {
	policy:
		'AI 요약은 제안이유 및 주요내용 원문에 근거해 핵심 정책 변화와 영향만을 한 문장으로 전달합니다. 찬반 평가나 가치 판단을 덧붙이지 않으며, 원문에 없는 사실이나 전망을 생성하지 않습니다.',
	prompt: [
		'당신은 국회 입법예고 요약 도우미입니다. 아래 규칙을 위반하지 마세요.',
		'',
		'[출력 규칙]',
		'1) 한국어 한 문장만 출력합니다.',
		'2) 줄바꿈 없이 평문으로만 출력합니다.',
		'3) "요약:", "설명:", "참고:" 같은 머리말을 금지합니다.',
		'4) 목록 기호, 마크다운, 따옴표, 코드블록을 금지합니다.',
		'5) 법률안명은 반복하지 말고 핵심 정책 변화와 영향만 씁니다.',
		'',
		'[출력 형식]',
		'반드시 요약 문장 하나만 출력',
		'',
		'법률안명: {{법률안명}}',
		'제안이유 및 주요내용: {{제안이유 및 주요내용}}'
	].join('\n'),
	generationOptions: {
		temperature: 0.2,
		numPredict: 220
	},
	inputFields: ['법률안명', '제안이유 및 주요내용']
};
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
	},
	aiSummary: FALLBACK_AI_SUMMARY
};

export const load: PageServerLoad = async ({ fetch }) => {
	if (isDiffchainUiMockEnabled()) {
		return {
			transparency: getMockCrawlingTransparencyData(),
			fetchedAt: new Date().toISOString()
		};
	}

	try {
		const transparency = await apiClient.getCrawlingTransparency(fetch);
		return {
			transparency,
			fetchedAt: new Date().toISOString()
		};
	} catch (err) {
		console.error('Failed to load crawling transparency data:', err);
		const loadError = toLoadErrorPayload(err, '투명성 정보를 불러오지 못했습니다.');
		return {
			transparency: FALLBACK,
			fetchedAt: new Date().toISOString(),
			loadError
		};
	}
};
