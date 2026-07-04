import { env } from '$env/dynamic/private';
import type {
	ArchiveNoticeListResponse,
	Notice,
	NoticeChangeDetail,
	NoticeChangeTimelineResponse,
	NoticeDetail,
	SystemStats
} from '$lib/types/api';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

const MOCK_NOW = Date.now();

const DEFAULT_MOCK_PAGE_SIZE = 10;

type MockNoticeTemplate = Notice & {
	revision: {
		headRev: number;
		currentLifecycleStatus: NonNullable<Notice['lifecycleStatus']>;
		sourceDeletedAt: string | null;
	};
};

type MockNoticeRecord = {
	notice: MockNoticeTemplate;
	originalContent: NoticeDetail['originalContent'];
	archiveMetadata: NoticeDetail['archiveMetadata'];
	changes: NoticeChangeTimelineResponse;
};

export function isDiffchainUiMockEnabled(): boolean {
	const rawValue = env.DIFFCHAIN_UI_MOCK?.trim().toLowerCase();
	return rawValue ? ENABLED_VALUES.has(rawValue) : false;
}

function daysAgo(days: number): string {
	return new Date(MOCK_NOW - days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
	return new Date(MOCK_NOW - hours * 60 * 60 * 1000).toISOString();
}

function buildDetail(
	fieldPath: string,
	changeType: NoticeChangeDetail['changeType'],
	beforeValue: string | null,
	afterValue: string | null,
	id: number
): NoticeChangeDetail {
	return {
		id,
		fieldPath,
		changeType,
		beforeValue,
		afterValue,
		beforeHash: null,
		afterHash: null
	};
}

function buildMockChangeTimeline(
	noticeNum: number,
	sourceState: MockNoticeTemplate['revision']['currentLifecycleStatus'],
	sourceDeletedAt: string | null
): NoticeChangeTimelineResponse {
	const baseEvents = [
		{
			id: noticeNum * 10 + 1,
			noticeNum,
			detectedAt: hoursAgo(72),
			eventType: 'created' as const,
			source: 'archive:upsert',
			eventHeight: 1,
			prevEventHash: null,
			eventHash: `mock-${noticeNum}-event-1`,
			changedFieldCount: 4,
			hashAlgo: 'sha256',
			canonVersion: 1,
			diffSummary: {
				type: 'mock',
				message: '기본 정보가 아카이브에 최초 저장되었습니다.'
			},
			details: [
				buildDetail(
					'subject',
					'added',
					null,
					'AI·데이터 산업 진흥에 관한 법률안',
					noticeNum * 100 + 1
				),
				buildDetail('billNumber', 'added', null, String(noticeNum), noticeNum * 100 + 2),
				buildDetail('lifecycleStatus', 'added', null, 'active', noticeNum * 100 + 3)
			]
		},
		{
			id: noticeNum * 10 + 2,
			noticeNum,
			detectedAt: hoursAgo(12),
			eventType: 'updated' as const,
			source: 'archive:updateSourceHtml',
			eventHeight: 2,
			prevEventHash: `mock-${noticeNum}-event-1`,
			eventHash: `mock-${noticeNum}-event-2`,
			changedFieldCount: 3,
			hashAlgo: 'sha256',
			canonVersion: 1,
			diffSummary: {
				type: 'mock',
				message: '원문과 처리 상태가 일부 갱신되었습니다.'
			},
			details: [
				buildDetail(
					'proposalReason',
					'modified',
					'기존 제안 이유 초안',
					'개정된 제안 이유(이해관계자 의견 반영)',
					noticeNum * 100 + 4
				),
				buildDetail('isDone', 'modified', 'false', 'true', noticeNum * 100 + 5)
			]
		},
		{
			id: noticeNum * 10 + 3,
			noticeNum,
			detectedAt: hoursAgo(1),
			eventType: 'invalidated' as const,
			source: sourceState === 'source_deleted' ? 'archive:source-missing' : 'archive:renumbered',
			eventHeight: 3,
			prevEventHash: `mock-${noticeNum}-event-2`,
			eventHash: `mock-${noticeNum}-event-3`,
			changedFieldCount: 2,
			hashAlgo: 'sha256',
			canonVersion: 1,
			diffSummary: {
				type: 'mock',
				message:
					sourceState === 'source_deleted'
						? '원본 소스에서 사라져 보존 상태로 전환되었습니다.'
						: '의안번호가 변경되어 기존 체인이 무효화되었습니다.'
			},
			details: [
				buildDetail('lifecycleStatus', 'modified', 'active', sourceState, noticeNum * 100 + 6),
				buildDetail('sourceDeletedAt', 'modified', null, sourceDeletedAt, noticeNum * 100 + 7)
			]
		}
	];

	return {
		noticeNum,
		items: baseEvents,
		count: baseEvents.length
	};
}

function buildMockNoticeRecord(noticeNum: number): MockNoticeRecord {
	const slot = Math.abs(noticeNum) % 3;
	const isDeleted = slot === 2;
	const isRenumbered = slot === 1;
	const lifecycleStatus = isDeleted ? 'source_deleted' : isRenumbered ? 'renumbered' : 'active';
	const sourceDeletedAt = isDeleted ? hoursAgo(1) : null;

	const notice: MockNoticeTemplate = {
		num: noticeNum,
		subject:
			lifecycleStatus === 'source_deleted'
				? '원본 소스 미존재 보존 테스트 법률안'
				: lifecycleStatus === 'renumbered'
					? '의안번호 변경 체인 테스트 법률안'
					: 'Project Diffchain UI 테스트 법률안',
		proposerCategory: '의원',
		committee: '법제사법위원회',
		link: `https://example.com/lawcast/mock/${noticeNum}`,
		contentId: `mock-content-${noticeNum}`,
		isDone: lifecycleStatus !== 'source_deleted',
		archiveStartedAt: daysAgo(6),
		lastUpdatedAt: hoursAgo(1),
		aiSummary: '이 항목은 Project Diffchain UI 미리보기용 가짜 데이터입니다.',
		aiSummaryStatus: 'ready',
		lifecycleStatus,
		sourceDeletedAt,
		attachments: {
			pdfFile: `https://example.com/lawcast/mock/${noticeNum}.pdf`,
			hwpFile: `https://example.com/lawcast/mock/${noticeNum}.hwp`
		},
		revision: {
			headRev: 3,
			currentLifecycleStatus: lifecycleStatus,
			sourceDeletedAt
		}
	};

	return {
		notice,
		originalContent: {
			contentId: notice.contentId ?? `mock-content-${noticeNum}`,
			title: notice.subject,
			proposalReason:
				lifecycleStatus === 'source_deleted'
					? '소스 삭제 전 제안이유 원문입니다. 현재는 보존 상태이므로 이 내용은 변경 이력에서만 확인할 수 있습니다.'
					: 'Project Diffchain 기능 검증을 위해 준비한 가짜 제안이유 원문입니다.',
			billNumber: String(noticeNum),
			proposer: '홍길동 의원 외 12인',
			proposalDate: '2026-06-14',
			committee: notice.committee,
			referralDate: '2026-06-18',
			noticePeriod: '2026-06-14 ~ 2026-06-28',
			proposalSession: '제22대 국회 제1회 정기회'
		},
		archiveMetadata: {
			archivedAt: daysAgo(5),
			sourceHtmlSha256: `mock-sha256-${noticeNum}`,
			sourceHtmlSize: 48321,
			integrity: {
				checkedAt: hoursAgo(4),
				passed: lifecycleStatus !== 'source_deleted',
				calculatedSha256: `mock-calculated-${noticeNum}`
			},
			http: {
				fetchedAt: daysAgo(6),
				statusCode: 200,
				contentType: 'text/html; charset=utf-8',
				etag: `mock-etag-${noticeNum}`,
				lastModified: daysAgo(6),
				requestUrl: `https://example.com/lawcast/mock/${noticeNum}`,
				responseUrl: `https://example.com/lawcast/mock/${noticeNum}`
			}
		},
		changes: buildMockChangeTimeline(noticeNum, lifecycleStatus, sourceDeletedAt)
	};
}

function buildMockNoticeDetail(noticeNum: number, requestedRev?: number): NoticeDetail {
	const record = buildMockNoticeRecord(noticeNum);
	const resolvedRev = requestedRev && requestedRev > 0 ? requestedRev : null;
	const headRev = record.notice.revision.headRev;
	const isHistorical = resolvedRev !== null && resolvedRev < headRev;
	const lifecycleStatus =
		resolvedRev !== null && resolvedRev < headRev
			? 'active'
			: record.notice.revision.currentLifecycleStatus;
	const sourceDeletedAt =
		resolvedRev !== null && resolvedRev < headRev ? null : record.notice.revision.sourceDeletedAt;

	return {
		notice: {
			num: record.notice.num,
			subject: record.notice.subject,
			proposerCategory: record.notice.proposerCategory,
			committee: record.notice.committee,
			link: record.notice.link,
			isDone: record.notice.isDone,
			archiveStartedAt: record.notice.archiveStartedAt,
			lastUpdatedAt: record.notice.lastUpdatedAt,
			aiSummary: record.notice.aiSummary,
			aiSummaryStatus: record.notice.aiSummaryStatus,
			lifecycleStatus,
			sourceDeletedAt,
			contentId: record.notice.contentId,
			attachments: record.notice.attachments
		},
		originalContent: record.originalContent,
		archiveMetadata: record.archiveMetadata,
		screenshotMeta: {
			hasScreenshot: true,
			format: 'jpeg'
		},
		aiSummaryEnabled: true,
		revision: {
			requestedRev: resolvedRev,
			resolvedRev,
			headRev,
			hasDiffchain: true,
			isHistorical
		}
	};
}

function buildMockArchiveNotices(): Notice[] {
	return [2210001, 2210002, 2210003, 2210004].map((noticeNum) => {
		const { notice } = buildMockNoticeRecord(noticeNum);
		return {
			num: notice.num,
			subject: notice.subject,
			proposerCategory: notice.proposerCategory,
			committee: notice.committee,
			link: notice.link,
			isDone: notice.isDone,
			archiveStartedAt: notice.archiveStartedAt,
			lastUpdatedAt: notice.lastUpdatedAt,
			aiSummary: notice.aiSummary,
			aiSummaryStatus: notice.aiSummaryStatus,
			lifecycleStatus: notice.lifecycleStatus,
			sourceDeletedAt: notice.sourceDeletedAt,
			contentId: notice.contentId,
			attachments: notice.attachments
		};
	});
}

export function getMockRecentNotices(): Notice[] {
	return buildMockArchiveNotices().slice(0, 3);
}

export function getMockArchiveNoticesResponse(params: {
	page: number;
	limit: number;
	search?: string;
	startDate?: string;
	endDate?: string;
	sortOrder?: 'asc' | 'desc';
	isDone?: boolean;
	fullText?: boolean;
}): ArchiveNoticeListResponse {
	const allNotices = buildMockArchiveNotices();
	const search = (params.search || '').trim().toLowerCase();
	let filtered = [...allNotices];

	if (search) {
		filtered = filtered.filter((notice) => {
			const haystack = [notice.subject, notice.committee, notice.proposerCategory, notice.contentId]
				.join(' ')
				.toLowerCase();
			return haystack.includes(search);
		});
	}

	if (params.isDone !== undefined) {
		filtered = filtered.filter((notice) => notice.isDone === params.isDone);
	}

	if (params.sortOrder === 'asc') {
		filtered.sort((a, b) => a.num - b.num);
	} else {
		filtered.sort((a, b) => b.num - a.num);
	}

	const total = filtered.length;
	const page = Math.max(1, params.page);
	const limit = Math.max(1, Math.min(20, params.limit || DEFAULT_MOCK_PAGE_SIZE));
	const start = (page - 1) * limit;
	const items = filtered.slice(start, start + limit);

	return {
		items,
		page,
		limit,
		total,
		totalPages: Math.max(1, Math.ceil(total / limit)),
		search: params.search ?? '',
		startDate: params.startDate,
		endDate: params.endDate,
		sortOrder: params.sortOrder,
		aiSummaryEnabled: true,
		stats: {
			cacheCount: total,
			matchedCacheCount: total,
			archiveCount: total,
			totalArchiveCount: total,
			mergedCount: total
		}
	};
}

export function getMockNoticeDetail(noticeNum: number, requestedRev?: number): NoticeDetail {
	return buildMockNoticeDetail(noticeNum, requestedRev);
}

export function getMockNoticeChanges(noticeNum: number): NoticeChangeTimelineResponse {
	return buildMockNoticeRecord(noticeNum).changes;
}

export function getMockSystemStats(): SystemStats {
	return {
		webhooks: {
			total: 4,
			active: 3,
			inactive: 1,
			oldInactive: 0,
			recentInactive: 1,
			efficiency: 75
		},
		cache: {
			size: 4,
			lastUpdated: hoursAgo(1),
			maxSize: 10,
			isInitialized: true
		},
		archive: {
			count: 4,
			isDoneSync: {
				status: 'idle',
				lastRunAt: hoursAgo(2),
				lastResult: {
					fetchedDoneCount: 2,
					markedDoneCount: 0
				},
				lastError: null
			},
			legacyGenesisSeed: {
				status: 'idle',
				lastRunAt: hoursAgo(3),
				lastError: null
			}
		},
		batchProcessing: {
			jobCount: 1,
			jobIds: ['mock-change-batch-1'],
			isShuttingDown: false,
			activeTimeouts: 0,
			recentJobs: [
				{
					id: 'mock-change-batch-1',
					startedAt: hoursAgo(3),
					completedAt: hoursAgo(3),
					totalJobs: 4,
					successCount: 4,
					failedCount: 0,
					duration: 4200,
					status: 'completed'
				}
			]
		},
		ollama: {
			enabled: true,
			configured: true,
			model: 'mock-diffchain-ui',
			summary: {
				total: 8,
				success: 8,
				failed: 0,
				skipped: 0,
				successRate: 100,
				lastLatencyMs: 210,
				lastSuccessAt: hoursAgo(1),
				lastFailureAt: null,
				lastError: null
			},
			health: {
				status: 'healthy',
				lastCheckedAt: hoursAgo(1),
				lastLatencyMs: 210,
				availableModelCount: 2,
				error: null
			}
		},
		aiSummaryEnabled: true
	};
}
