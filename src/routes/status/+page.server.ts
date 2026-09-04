import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import { isDiffchainUiMockEnabled, getMockSystemStats } from '$lib/server/diffchain-ui-mock';

export const load: PageServerLoad = async ({ fetch }) => {
	if (isDiffchainUiMockEnabled()) {
		return {
			stats: getMockSystemStats(),
			fetchedAt: new Date().toISOString()
		};
	}

	try {
		const stats = await apiClient.getSystemStats(fetch);
		return {
			stats,
			fetchedAt: new Date().toISOString()
		};
	} catch (err) {
		console.error('Failed to load status page data:', err);
		return {
			stats: {
				webhooks: { total: 0, active: 0, inactive: 0, efficiency: 0 },
				webPush: { total: 0, active: 0, inactive: 0, withFailures: 0 },
				cache: { size: 0, lastUpdated: null, maxSize: 10, isInitialized: false },
				archive: { count: 0, isDoneSync: null, legacyGenesisSeed: null },
				ollama: {
					enabled: false,
					configured: false,
					model: null,
					summary: {
						total: 0,
						success: 0,
						failed: 0,
						skipped: 0,
						successRate: 0,
						lastLatencyMs: null,
						lastSuccessAt: null,
						lastFailureAt: null,
						lastError: null
					},
					health: {
						status: 'unknown',
						lastCheckedAt: null,
						lastLatencyMs: null,
						availableModelCount: null,
						error: null
					}
				},
				aiSummaryEnabled: false,
				crawlers: {
					palCrawler: {
						name: '국회 입법예고 크롤러 (PAL)',
						source: 'pal.assembly.go.kr',
						status: 'idle',
						lastRunAt: null,
						lastError: null,
						cron: { expression: '2-59/10 * * * *', intervalMs: 600000, description: '매 10분' }
					},
					nsmPendingCrawler: {
						name: '국민참여입법센터 크롤러 (NSM)',
						source: 'opinion.lawmaking.go.kr',
						status: 'idle',
						lastRunAt: null,
						lastError: null,
						cron: { expression: '6-59/20 * * * *', intervalMs: 1200000, description: '매 20분' }
					},
					archiveSync: { isRunning: false, runningPhases: [], phases: [], asyncApply: null },
					cronJobs: []
				}
			},
			fetchedAt: new Date().toISOString(),
			error: '상태 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
		};
	}
};
