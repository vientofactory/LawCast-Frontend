export type AISummaryStatus = 'ready' | 'unavailable' | 'not_supported' | 'not_requested';

export interface Notice {
	num: number;
	subject: string;
	proposerCategory: string;
	committee: string;
	link: string;
	isDone?: boolean;
	archiveStartedAt?: string;
	lastUpdatedAt?: string;
	aiSummary?: string | null;
	aiSummaryStatus?: AISummaryStatus;
	contentId?: string | null;
	attachments: {
		pdfFile: string;
		hwpFile: string;
	};
}

export interface NoticeOriginalContent {
	contentId: string;
	title: string;
	proposalReason: string;
	billNumber: string | null;
	proposer: string | null;
	proposalDate: string | null;
	committee: string | null;
	referralDate: string | null;
	noticePeriod: string | null;
	proposalSession: string | null;
}

export interface NoticeArchiveMetadata {
	archivedAt: string | null;
	sourceHtmlSha256: string | null;
	sourceHtmlSize: number;
	integrity: {
		checkedAt: string | null;
		passed: boolean | null;
		calculatedSha256: string | null;
	};
	http: {
		fetchedAt: string | null;
		statusCode: number | null;
		contentType: string | null;
		etag: string | null;
		lastModified: string | null;
		requestUrl?: string;
		responseUrl?: string;
	};
}

export interface NoticeDetail {
	notice: Notice;
	originalContent: NoticeOriginalContent;
	archiveMetadata: NoticeArchiveMetadata;
	screenshotMeta: {
		hasScreenshot: boolean;
		format: string | null;
	};
	aiSummaryEnabled?: boolean;
}

export interface ArchiveNoticeListResponse {
	items: Notice[];
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	search: string;
	startDate?: string;
	endDate?: string;
	sortOrder?: 'asc' | 'desc';
	aiSummaryEnabled?: boolean;
	stats: {
		cacheCount: number;
		matchedCacheCount: number;
		archiveCount: number;
		totalArchiveCount: number;
		mergedCount: number;
	};
}

export interface SearchNoticesItem {
	num: number;
	subject: string;
	proposerCategory: string;
	committee: string;
	link: string;
	contentId: string | null;
	isDone: boolean;
	isArchived: boolean;
	aiSummary: string | null;
	aiSummaryStatus: AISummaryStatus;
	attachments: { pdfFile: string; hwpFile: string };
	archiveStartedAt: string | null;
	lastUpdatedAt: string | null;
}

export interface SearchNoticesResult {
	items: SearchNoticesItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	keyword: string;
	source: 'archive' | 'crawler' | 'mixed';
}

export interface WebhookStats {
	total: number;
	active: number;
	inactive?: number;
	oldInactive?: number;
	recentInactive?: number;
	efficiency?: number;
}

export interface CacheInfo {
	size: number;
	lastUpdated: string | null;
	maxSize: number;
	isInitialized: boolean;
}

export type OllamaHealthStatus = 'disabled' | 'misconfigured' | 'unknown' | 'healthy' | 'unhealthy';

export interface OllamaMetrics {
	enabled: boolean;
	configured: boolean;
	model: string | null;
	summary: {
		total: number;
		success: number;
		failed: number;
		skipped: number;
		successRate: number;
		lastLatencyMs?: number | null;
		lastSuccessAt?: string | null;
		lastFailureAt?: string | null;
		lastError?: string | null;
	};
	health: {
		status: OllamaHealthStatus;
		lastCheckedAt: string | null;
		lastLatencyMs: number | null;
		availableModelCount: number | null;
		error?: string | null;
	};
}

export interface BatchRunRecord {
	id: string;
	startedAt: string;
	completedAt: string | null;
	totalJobs: number;
	successCount: number;
	failedCount: number;
	duration: number | null;
	status: 'running' | 'completed' | 'failed';
	error?: string | null;
	metadata?: Record<string, unknown>;
}

export interface BatchProcessingStats {
	jobCount: number;
	jobIds?: string[];
	isShuttingDown?: boolean;
	activeTimeouts?: number;
	recentJobs?: BatchRunRecord[];
}

export interface IsDoneSyncResult {
	fetchedDoneCount: number;
	markedDoneCount: number;
	revertedCount: number;
	totalScanned: number;
}

export interface IsDoneSyncStatus {
	status: 'idle' | 'running' | 'failed';
	/** ISO-8601 timestamp of the last completed (or failed) run. */
	lastRunAt: string | null;
	lastResult: IsDoneSyncResult | null;
	lastError: string | null;
}

export interface SystemStats {
	webhooks: WebhookStats;
	cache: CacheInfo;
	archive: {
		count: number;
		isDoneSync?: IsDoneSyncStatus | null;
	};
	batchProcessing?: BatchProcessingStats;
	ollama?: OllamaMetrics;
	aiSummaryEnabled?: boolean;
	nodeRuntime?: {
		eventLoopDelay: {
			min: number;
			max: number;
			mean: number;
			stddev: number;
			percentiles: { p50: number; p90: number; p99: number };
			exceeds: number;
			lastUpdated: number;
		} | null;
		memory: {
			rss: number;
			heapTotal: number;
			heapUsed: number;
			external: number;
			arrayBuffers: number;
		};
	};
}

export interface SystemHealthStats {
	total: number;
	active: number;
	inactive?: number;
	oldInactive?: number;
	recentInactive?: number;
	efficiency: number;
}

export interface SystemHealth {
	efficiency: number;
	stats: SystemHealthStats;
	status: 'healthy' | 'needs_optimization';
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	message?: string;
	errors?: string[];
}

export interface WebhookRegistrationRequest {
	url: string;
	proof: string;
}

export interface WebhookValidationResult {
	isValid: boolean;
	message?: string;
}

export interface ApiError extends Error {
	status?: number;
	response?: {
		status: number;
		data?: {
			message?: string;
			errors?: string[];
		};
	};
}
