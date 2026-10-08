export type AISummaryStatus = 'ready' | 'unavailable' | 'not_supported' | 'not_requested';
export type NoticeLifecycleStatus = 'active' | 'source_deleted' | 'renumbered';

export interface Notice {
	num: number;
	subject: string;
	proposerCategory: string;
	committee: string;
	link: string;
	isDone?: boolean;
	/** Raw notice period (e.g. "2026-06-14 ~ 2026-06-28"); present when the endpoint provides it. */
	noticePeriod?: string | null;
	archiveStartedAt?: string;
	lastUpdatedAt?: string;
	aiSummary?: string | null;
	aiSummaryStatus?: AISummaryStatus;
	lifecycleStatus?: NoticeLifecycleStatus;
	sourceDeletedAt?: string | null;
	contentId?: string | null;
	changeEventCount?: number;
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
		status?: 'pending' | 'passed' | 'failed' | 'skipped';
		checkedAt: string | null;
		passed: boolean | null;
		skipReason?: string | null;
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
		captureStatus: string | null;
		captureError: string | null;
	};
	aiSummaryEnabled?: boolean;
	revision?: {
		requestedRev: number | null;
		resolvedRev: number | null;
		headRev: number | null;
		hasDiffchain: boolean;
		isHistorical: boolean;
		hasLegacyGenesisBoundary?: boolean;
		legacyGenesisBoundaryAt?: string | null;
	};
	changes?: NoticeChangeTimelineResponse;
}

export type ChangeEventType = 'created' | 'updated' | 'invalidated';
export type ChangeDetailType = 'added' | 'removed' | 'modified';

export interface NoticeChangeDetail {
	id: number;
	fieldPath: string;
	changeType: ChangeDetailType;
	beforeValue: string | null;
	afterValue: string | null;
	beforeHash: string | null;
	afterHash: string | null;
}

export interface NoticeChangeEventItem {
	id: number;
	noticeNum: number;
	detectedAt: string;
	eventType: ChangeEventType;
	source: string | null;
	eventHeight: number;
	prevEventHash: string | null;
	eventHash: string;
	changedFieldCount: number;
	hashAlgo: string;
	canonVersion: number;
	diffSummary: Record<string, unknown> | null;
	details: NoticeChangeDetail[];
}

export interface NoticeChangeTimelineResponse {
	noticeNum: number;
	items: NoticeChangeEventItem[];
	count: number;
}

export interface RecentNoticeChangeItem {
	id: number;
	noticeNum: number;
	subject?: string | null;
	detectedAt: string;
	eventType: ChangeEventType;
	source: string | null;
	eventHeight: number;
	eventHash: string;
	changedFieldCount: number;
	diffSummary: Record<string, unknown> | null;
}

export interface RecentNoticeChangesResponse {
	items: RecentNoticeChangeItem[];
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	anchorPage?: number | null;
	nextCursor?: string | null;
}

export interface ComparableChangeSummary {
	comparableEventTotal: number;
	comparableNoticeCount: number;
}

export interface ArchiveNoticeListResponse {
	items: Notice[];
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	search: string;
	proposer?: string;
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
	lifecycleStatus?: NoticeLifecycleStatus;
	sourceDeletedAt?: string | null;
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

/**
 * Semantic search response.
 * `keyword_fallback` means the backend could not use the semantic engine and
 * answered from the regular keyword search instead; `fallbackReason` carries
 * the cause. `results` holds only confident hits above the similarity
 * threshold, `weakResults` the weaker-but-relevant hits above the unrelated
 * threshold — shown only behind the empty-state reveal button. Results the
 * engine deems unrelated appear in neither list.
 */
export type SemanticSearchMode = 'semantic' | 'keyword_fallback';

export interface SemanticSearchResultItem {
	noticeNum: number;
	subject: string;
	committee: string;
	section: string | null;
	score: number | null;
	excerpt: string | null;
}

export interface SemanticSearchResponse {
	query: string;
	mode: SemanticSearchMode;
	fallbackReason: string | null;
	lastUpdateAt: string | null;
	results: SemanticSearchResultItem[];
	weakResults: SemanticSearchResultItem[];
}

/**
 * Semantic engine readiness (the backend `/api/notices/semantic-search/health`
 * passes the sidecar `/health` `status` field through unchanged).
 * `loading` = engine starting, `ready` = serving, `failed` = unrecoverable
 * load error.
 */
export type SemanticEngineStatus = 'loading' | 'ready' | 'failed';

/**
 * Semantic engine health (fields passed through from the sidecar `/health` by
 * the backend `/api/notices/semantic-search/health`).
 * `status` gates the search UI overlay, `indexedChunks` is the FAISS chunk
 * count, `lastUpdateAt` the last index write time of the serving generation,
 * `lastUpdateTriggeredAt` the run time of the most recent refresh tick
 * (null when never triggered).
 */
export interface SemanticEngineHealthResponse {
	status: SemanticEngineStatus;
	indexedChunks: number;
	lastUpdateAt: string | null;
	lastUpdateTriggeredAt: string | null;
}

export interface QuickKeywordSuggestion {
	keyword: string;
	score: number;
	matchCount: number;
}

export interface QuickKeywordSuggestionsResponse {
	items: QuickKeywordSuggestion[];
	updatedAt: string | null;
	sourceNoticeCount: number;
	refreshIntervalMs: number;
}

export interface WebhookStats {
	total: number;
	active: number;
	inactive?: number;
	oldInactive?: number;
	recentInactive?: number;
	efficiency?: number;
}

export interface WebPushStats {
	total: number;
	active: number;
	inactive: number;
	withFailures: number;
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

export interface CrawlerStatus {
	name: string;
	source: string;
	status: 'idle' | 'running' | 'failed';
	lastRunAt: string | null;
	lastError: string | null;
	cron: {
		expression: string;
		intervalMs: number;
		description: string;
	};
}

export interface ArchiveSyncPhaseStatus {
	name: string;
	status: string;
	lastRunAt: string | null;
	lastError: string | null;
}

export interface ArchiveSyncDetailedStatus {
	isRunning: boolean;
	runningPhases: string[];
	phases: ArchiveSyncPhaseStatus[];
	asyncApply: Record<string, unknown> | null;
}

export interface CronJobStatus {
	name: string;
	status: 'idle' | 'running' | 'failed';
	lastRunAt: string | null;
	lastError: string | null;
	cron: {
		expression: string;
		intervalMs: number;
		description: string;
	};
}

export interface IsDoneSyncResult {
	fetchedDoneCount: number;
	markedDoneCount: number;
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
	webPush?: WebPushStats;
	cache: CacheInfo;
	archive: {
		count: number;
		isDoneSync?: IsDoneSyncStatus | null;
		legacyGenesisSeed?: {
			status: 'idle' | 'running' | 'failed';
			lastRunAt: string | null;
			lastError: string | null;
		} | null;
	};
	changeTracking?: ComparableChangeSummary;
	ollama?: OllamaMetrics;
	aiSummaryEnabled?: boolean;
	nodeRuntime?: {
		memory: {
			rss: number;
			heapTotal: number;
			heapUsed: number;
			external: number;
			arrayBuffers: number;
		};
	};
	crawlers?: {
		palCrawler: CrawlerStatus;
		nsmPendingCrawler: CrawlerStatus;
		archiveSync: ArchiveSyncDetailedStatus;
		cronJobs: CronJobStatus[];
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

export interface WebPushPublicConfig {
	enabled: boolean;
	publicKey: string | null;
}

export interface DiscussionWebPushStatus {
	isBound: boolean;
}

export interface WebPushNoticeStatus {
	enabled: boolean;
}

export interface WebPushSubscriptionRequest {
	endpoint: string;
	p256dh: string;
	auth: string;
	proof: string;
	threadId?: number;
}

export interface WebhookValidationResult {
	isValid: boolean;
	message?: string;
}

export interface ApiError extends Error {
	status?: number;
	retryAfter?: number;
	response?: {
		status: number;
		data?: {
			message?: string;
			errors?: string[];
		};
	};
}

// ── Crawling Transparency ───────────────────────────────────────────────

export interface CrawlingSource {
	id: string;
	name: string;
	url: string;
	description: string;
	noticeCount: number;
	intervalMs: number;
	intervalLabel: string;
}

export interface CrawlingSchedule {
	id: string;
	name: string;
	intervalMs: number;
	intervalLabel: string;
	description: string;
}

export interface CrawlingTransferFlow {
	description: string;
	nsmToPalIndicator: string;
}

export interface CrawlingTransparencyData {
	noticeSources: CrawlingSource[];
	collection: {
		totalNotices: number;
		byLifecycle: Record<string, number>;
		bySource: Record<string, number>;
	};
	changeTracking: {
		totalEvents: number;
		byType: Record<string, number>;
	};
	schedules: CrawlingSchedule[];
	transferFlow: CrawlingTransferFlow;
}

// ── Proposal Statistics ─────────────────────────────────────────────────

export type ProposalStatisticsGranularity = 'daily' | 'weekly' | 'monthly';

export interface ProposalStatisticsBucket {
	period: string;
	count: number;
}

export interface ProposalStatisticsData {
	granularity: ProposalStatisticsGranularity;
	startDate: string | null;
	endDate: string | null;
	totalCount: number;
	buckets: ProposalStatisticsBucket[];
}

// ── Discussions (Wiki-style Anonymous Discussion) ───────────────────────

export enum DiscussionThreadStatus {
	OPEN = 'open',
	CLOSED = 'closed'
}

export enum DiscussionMessageType {
	USER = 'user',
	SYSTEM = 'system',
	ADMIN = 'admin'
}

export interface DiscussionThread {
	id: number;
	noticeNum: number;
	title: string;
	status: DiscussionThreadStatus;
	isLocked: boolean;
	authorNickname: string;
	authorIpMasked: string;
	commentCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface DiscussionComment {
	id: number;
	threadId: number;
	noticeNum: number;
	sequence: number;
	messageType: DiscussionMessageType;
	authorNickname: string;
	authorIpMasked: string;
	content: string;
	isDeleted: boolean;
	isEdited: boolean;
	editedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface DiscussionThreadListResponse {
	items: DiscussionThread[];
	total: number;
	page: number;
	limit: number;
}

export interface DiscussionThreadWithNotice extends DiscussionThread {
	noticeSubject: string | null;
}

export interface DiscussionThreadWithNoticeListResponse {
	items: DiscussionThreadWithNotice[];
	total: number;
	page: number;
	limit: number;
}

export interface DiscussionThreadDetailResponse {
	thread: DiscussionThread;
	comments: DiscussionComment[];
	hasMore?: boolean;
	nextCursor?: number | null;
}

export interface CreateThreadPayload {
	title: string;
	authorNickname?: string;
	password: string;
	content: string;
}

export interface CreateCommentPayload {
	authorNickname?: string;
	password: string;
	content: string;
}

export interface UpdateCommentPayload {
	password: string;
	content: string;
}

export interface DeleteCommentPayload {
	password: string;
}

export interface UpdateThreadStatusPayload {
	status: DiscussionThreadStatus;
	password: string;
}

// ── Admin notices (Notion-backed notice board) ─────────────────────────────

export interface AdminNotice {
	/** Notion page id */
	id: string;
	/** Notion `제목` — notice title */
	title: string;
	/** 공개 여부 — always true in responses (unpublished rows are filtered out) */
	published: boolean;
	/** 상태 (status/select option name), null when unset */
	status: string | null;
	/** 노출 순서, null when the property is empty */
	order: number | null;
	/** 긴급 checkbox — true when the operator marked the row urgent */
	urgent: boolean;
	/**
	 * 내용 — plain text preview from the Notion rich text property,
	 * newlines preserved. Serves as the list preview and as the body
	 * fallback when the page has no block children.
	 */
	content: string;
	/**
	 * Markdown body converted from the page's Notion block tree
	 * (notion-to-md). Empty when the page has no blocks or the
	 * conversion failed — the detail page then falls back to `content`.
	 */
	body: string;
	/**
	 * Notion page `created_time` — UTC ISO 8601 instant the row was created
	 * (immutable; reflects row creation, not the publication edit).
	 * Null when Notion omits the field.
	 */
	createdAt: string | null;
}

export interface AdminNoticeListResponse {
	items: AdminNotice[];
}

/**
 * Response of `GET /api/announcements/top` — a single notice for the two
 * cap-1 UI spots (home pinned chip, site-wide urgent banner), so global SSR
 * pages never serialize the whole list.
 */
export interface AdminNoticeTopResponse {
	/** Top display-order notice, or the first urgent one with `?urgent=true`. Null when none matches. */
	item: AdminNoticeCard | null;
}

// ── SSR minimal view cards ─────────────────────────────────────────────
// Server loaders map API responses onto these cards so a route's SSR payload
// carries ONLY the fields its UI renders (and nothing more). The full API
// types above stay intact for the client layer and for routes that render
// the complete objects.

/** Cap-1 notice view: the pinned chip and the urgent banner render id + title only. */
export interface AdminNoticeCard {
	id: string;
	title: string;
}

/** Fields rendered by the home recent list and the /notices board rows. */
export interface NoticeCard {
	num: number;
	subject: string;
	proposerCategory: string;
	committee: string;
	link: string;
	isDone?: boolean;
	noticePeriod?: string | null;
	aiSummary?: string | null;
	aiSummaryStatus?: AISummaryStatus;
	lifecycleStatus?: NoticeLifecycleStatus;
	changeEventCount?: number;
	attachments: Notice['attachments'];
}

/** Fields rendered on /discussions and the home recent-discussions card. */
export interface DiscussionThreadCard {
	id: number;
	noticeNum: number;
	noticeSubject: string | null;
	title: string;
	status: DiscussionThreadStatus;
	authorNickname: string;
	authorIpMasked: string;
	commentCount: number;
	updatedAt: string;
}

/** Fields rendered on the /notices/changes list (hashes/diff details stay server-side). */
export interface NoticeChangeCard {
	id: number;
	noticeNum: number;
	subject?: string | null;
	detectedAt: string;
	eventType: ChangeEventType;
	source: string | null;
	eventHeight: number;
	changedFieldCount: number;
}

export interface DiscussionThreadCardListResponse {
	items: DiscussionThreadCard[];
	total: number;
	page: number;
	limit: number;
}

export interface NoticeChangeCardListResponse {
	items: NoticeChangeCard[];
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

/** /notices board response with card items; every other field is unchanged. */
export interface ArchiveNoticeCardListResponse extends Omit<ArchiveNoticeListResponse, 'items'> {
	items: NoticeCard[];
}
