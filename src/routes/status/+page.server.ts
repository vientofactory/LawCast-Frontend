import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import type { SystemStats } from '$lib/types/api';

// ─── UI 미리보기용 목 플래그 ───────────────────────────────────────────────────
const USE_MOCK_DATA = false;
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_STATS: SystemStats = {
	webhooks: {
		total: 142,
		active: 118,
		inactive: 24,
		oldInactive: 8,
		recentInactive: 16,
		efficiency: 83
	},
	cache: {
		size: 47,
		lastUpdated: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
		maxSize: 200,
		isInitialized: true
	},
	archive: {
		count: 3821,
		isDoneSync: {
			status: 'idle',
			lastRunAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
			lastResult: {
				fetchedDoneCount: 1248,
				markedDoneCount: 3,
				revertedCount: 1,
				totalScanned: 84
			},
			lastError: null
		}
	},
	batchProcessing: {
		jobCount: 1,
		jobIds: ['batch_1745900001234_ab3f1'],
		isShuttingDown: false,
		activeTimeouts: 3,
		recentJobs: [
			{
				id: 'batch_1745900001234_ab3f1',
				startedAt: new Date(Date.now() - 8000).toISOString(),
				completedAt: null,
				totalJobs: 30,
				successCount: 0,
				failedCount: 0,
				duration: null,
				status: 'running'
			},
			{
				id: 'batch_1745899800000_c7d92',
				startedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
				completedAt: new Date(Date.now() - 2.5 * 60 * 1000).toISOString(),
				totalJobs: 50,
				successCount: 48,
				failedCount: 2,
				duration: 31200,
				status: 'completed'
			},
			{
				id: 'batch_1745899500000_e1a44',
				startedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
				completedAt: new Date(Date.now() - 5.8 * 60 * 1000).toISOString(),
				totalJobs: 20,
				successCount: 20,
				failedCount: 0,
				duration: 11800,
				status: 'completed'
			},
			{
				id: 'batch_1745899200000_f9b05',
				startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
				completedAt: new Date(Date.now() - 9.7 * 60 * 1000).toISOString(),
				totalJobs: 15,
				successCount: 0,
				failedCount: 15,
				duration: 18400,
				status: 'failed',
				error: 'Service is shutting down, cannot process new jobs'
			},
			{
				id: 'batch_1745898900000_a2c66',
				startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
				completedAt: new Date(Date.now() - 14.5 * 60 * 1000).toISOString(),
				totalJobs: 100,
				successCount: 100,
				failedCount: 0,
				duration: 29500,
				status: 'completed'
			}
		]
	},
	ollama: {
		enabled: true,
		configured: true,
		model: 'gemma3:12b',
		summary: {
			total: 512,
			success: 487,
			failed: 14,
			skipped: 11,
			successRate: 95.1,
			lastLatencyMs: 2340,
			lastSuccessAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
			lastFailureAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
			lastError: null
		},
		health: {
			status: 'healthy',
			lastCheckedAt: new Date(Date.now() - 90 * 1000).toISOString(),
			lastLatencyMs: 2340,
			availableModelCount: 3,
			error: null
		}
	},
	aiSummaryEnabled: true
};

export const load: PageServerLoad = async ({ fetch }) => {
	if (USE_MOCK_DATA) {
		return {
			stats: MOCK_STATS,
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
				cache: { size: 0, lastUpdated: null, maxSize: 10, isInitialized: false },
				archive: { count: 0, isDoneSync: null },
				batchProcessing: {
					jobCount: 0,
					jobIds: [],
					isShuttingDown: false,
					activeTimeouts: 0,
					recentJobs: []
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
