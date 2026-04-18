export interface Notice {
	num: number;
	subject: string;
	proposerCategory: string;
	committee: string;
	link: string;
	archiveStartedAt?: string;
	lastUpdatedAt?: string;
	aiSummary?: string | null;
	aiSummaryStatus?: 'ready' | 'unavailable' | 'not_supported' | 'not_requested';
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

export interface WebhookStats {
	total: number;
	active: number;
	inactive: number;
	efficiency?: number;
}

export interface CacheInfo {
	size: number;
	lastUpdated: string | null;
	maxSize: number;
	isInitialized: boolean;
}

export interface SystemStats {
	webhooks: WebhookStats;
	cache: CacheInfo;
	archive: {
		count: number;
	};
	aiSummaryEnabled?: boolean;
}

export interface SystemHealthStats {
	total: number;
	active: number;
	inactive: number;
	oldInactive: number;
	recentInactive: number;
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
