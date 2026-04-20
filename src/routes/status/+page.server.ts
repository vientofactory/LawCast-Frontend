import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
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
				cache: { size: 0, lastUpdated: null, maxSize: 10, isInitialized: false },
				archive: { count: 0 },
				batchProcessing: {
					jobCount: 0,
					jobIds: [],
					isShuttingDown: false,
					activeTimeouts: 0
				},
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
				aiSummaryEnabled: false
			},
			fetchedAt: new Date().toISOString(),
			error: '상태 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
		};
	}
};
