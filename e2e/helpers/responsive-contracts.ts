export const viewports = [
	{ name: 'small mobile', width: 320, height: 740 },
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'small desktop', width: 1024, height: 768 },
	{ name: 'desktop', width: 1440, height: 900 }
];

export type ResponsiveRoute = {
	path: string;
	visible: string[];
	text: { selector: string; maxLines: number }[];
};

export const routes: ResponsiveRoute[] = [
	{
		path: '/',
		visible: [
			'[data-testid="home-main"]',
			'[data-testid="home-hero"]',
			'[data-testid="home-status-card-archive"]',
			'[data-testid="home-status-card-changes"]',
			'[data-testid="home-status-card-sync"]',
			'[data-testid="home-status-card-review"]',
			'[data-testid="home-search-input"]',
			'[data-testid="home-search-submit"]'
		],
		text: [
			{ selector: '[data-testid="home-search-submit"]', maxLines: 1 },
			{ selector: '[data-testid="home-status-card-archive"] .lc-home-signal-value', maxLines: 2 }
		]
	},
	{
		path: '/notices?limit=10',
		visible: [
			'[data-testid="notices-main"]',
			'[data-testid="notices-results-summary"]',
			'[data-testid="notices-filter-form"]',
			'[data-testid="notices-quick-range-7-days"]',
			'[data-testid="notices-status-filter-active"]',
			'[data-testid="notices-search-submit"]',
			'[data-testid="notices-results-region"]',
			'[data-testid="notices-results-list"]'
		],
		text: [
			{ selector: '[data-testid="notices-quick-range-7-days"]', maxLines: 1 },
			{ selector: '[data-testid="notices-status-filter-active"]', maxLines: 1 },
			{ selector: '[data-testid="notices-search-submit"]', maxLines: 1 }
		]
	},
	{
		path: '/notices/2210001',
		visible: [
			'[data-testid="notice-detail-main"]',
			'[data-testid="notice-detail-summary"]',
			'#notice-detail-title',
			'[data-testid="notice-detail-discussions-anchor"]',
			'[data-testid="notice-detail-share"]',
			'[data-testid="notice-detail-open-source"]',
			'[data-testid="notice-detail-content"]',
			'[data-testid="notice-detail-proposal-reason"]'
		],
		text: [
			{ selector: '[data-testid="notice-detail-discussions-anchor"]', maxLines: 1 },
			{ selector: '[data-testid="notice-detail-share"]', maxLines: 1 },
			{ selector: '[data-testid="notice-detail-open-source"]', maxLines: 1 }
		]
	},
	{
		path: '/notices/changes',
		visible: ['main h1', '[data-testid="changes-results-region"]'],
		text: [{ selector: 'main h1', maxLines: 2 }]
	},
	{
		path: '/discussions',
		visible: [
			'main h1',
			'[data-testid="discussions-filter-all"]',
			'[data-testid="discussions-filter-open"]',
			'[data-testid="discussions-filter-closed"]',
			'[data-testid="discussions-list"]',
			'[data-testid="discussions-list-link-221000101"]'
		],
		text: [
			{ selector: '[data-testid="discussions-filter-all"]', maxLines: 1 },
			{ selector: '[data-testid="discussions-filter-open"]', maxLines: 1 },
			{ selector: '[data-testid="discussions-filter-closed"]', maxLines: 1 }
		]
	},
	{
		path: '/proposals',
		visible: [
			'main h1',
			'main button[aria-haspopup="true"]',
			'main button:has-text("일별")',
			'main button:has-text("주별")',
			'main button:has-text("월별")',
			'main button:has-text("막대 차트")',
			'main button:has-text("선형 차트")',
			'.chart-container canvas'
		],
		text: [
			{ selector: 'main h1', maxLines: 2 },
			{ selector: 'main button[aria-haspopup="true"]', maxLines: 1 },
			{ selector: 'main button:has-text("일별")', maxLines: 1 },
			{ selector: 'main button:has-text("주별")', maxLines: 1 },
			{ selector: 'main button:has-text("월별")', maxLines: 1 },
			{ selector: 'main button:has-text("막대 차트")', maxLines: 1 },
			{ selector: 'main button:has-text("선형 차트")', maxLines: 1 }
		]
	},
	{
		path: '/status',
		visible: [
			'main h1',
			'main button:has-text("새로고침")',
			'main h3:has-text("국회 입법예고 크롤러")',
			'main h3:has-text("국민참여입법센터 크롤러")',
			'main h2:has-text("크론 작업 현황")',
			'main h2:has-text("웹훅 상태")',
			'main h2:has-text("캐시 상태")',
			'main h2:has-text("웹 푸시 상태")',
			'main h2:has-text("AI 요약")',
			'main h2:has-text("종료 마커 동기화")'
		],
		text: [
			{ selector: 'main h1', maxLines: 2 },
			{ selector: 'main button:has-text("새로고침")', maxLines: 1 }
		]
	},
	{
		path: '/webhook',
		visible: [
			'main h2:has-text("디스코드 웹훅 등록")',
			'main input#webhook-url',
			'main button[type="submit"]',
			'main h2:has-text("브라우저 웹 푸시 알림")',
			'main h3:has-text("입법예고 알림")'
		],
		text: [
			{ selector: 'main h2:has-text("디스코드 웹훅 등록")', maxLines: 2 },
			{ selector: 'main button[type="submit"]', maxLines: 1 },
			{ selector: 'main h3:has-text("입법예고 알림")', maxLines: 2 }
		]
	}
];
