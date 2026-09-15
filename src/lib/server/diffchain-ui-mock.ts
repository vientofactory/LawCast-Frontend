import { env } from '$env/dynamic/private';
import {
	DiscussionMessageType,
	DiscussionThreadStatus,
	type NoticeLifecycleStatus
} from '$lib/types/api';
import type {
	ArchiveNoticeListResponse,
	QuickKeywordSuggestionsResponse,
	Notice,
	NoticeChangeDetail,
	NoticeChangeTimelineResponse,
	RecentNoticeChangesResponse,
	NoticeDetail,
	SystemStats,
	DiscussionThreadListResponse,
	DiscussionThreadWithNoticeListResponse,
	DiscussionThreadDetailResponse,
	CrawlingTransparencyData,
	ProposalStatisticsData,
	ProposalStatisticsGranularity
} from '$lib/types/api';
import { NoticeChangeSource } from '$lib/types/change-source';

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
			source: NoticeChangeSource.ARCHIVE_UPSERT,
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
			source: NoticeChangeSource.ARCHIVE_UPDATE_SOURCE_HTML,
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
			source:
				sourceState === 'source_deleted'
					? NoticeChangeSource.ARCHIVE_SOURCE_MISSING
					: NoticeChangeSource.ARCHIVE_RENUMBERED,
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

/** Archive-only overrides for diverse mock data used in e2e filter tests. */
const MOCK_ARCHIVE_OVERRIDE_CONFIG: {
	num: number;
	subject: string;
	committee: string;
	archiveDaysAgo: number;
	isDoneOverride?: boolean;
	proposalReason?: string;
}[] = [
	// ── Core 4 notices (varied isDone, committees, dates, fullText keywords) ──
	{
		num: 2210001,
		subject: 'AI·데이터 산업 진흥에 관한 법률안',
		committee: '과학기술정보방송통신위원회',
		archiveDaysAgo: 3,
		isDoneOverride: false,
		proposalReason: 'AI 산업의 건전한 성장과 개인정보 보호를 위한 제도적 기반을 마련하기 위함.'
	},
	{
		num: 2210002,
		subject: '개인정보 보호법 일부개정법률안',
		committee: '법제사법위원회',
		archiveDaysAgo: 10,
		isDoneOverride: true,
		proposalReason: '개인정보 침해 사고의 신속한 대응과 피해 구제를 강화하기 위함.'
	},
	{
		num: 2210003,
		subject: '중대재해 처벌 등에 관한 법률안',
		committee: '환경노동위원회',
		archiveDaysAgo: 1,
		isDoneOverride: false,
		proposalReason: '중대 산업재해 예방과 안전보건 확보 의무를 강화하기 위함.'
	},
	{
		num: 2210004,
		subject: '플랫폼 공정화에 관한 법률안',
		committee: '정무위원회',
		archiveDaysAgo: 20,
		isDoneOverride: true,
		proposalReason: '플랫폼 경제에서의 공정한 거래 질서를 확립하기 위함.'
	},
	// ── Additional notices for pagination testing (limit=10 triggers page 2) ──
	{
		num: 2210005,
		subject: '근로기준법 일부개정법률안',
		committee: '환경노동위원회',
		archiveDaysAgo: 5,
		isDoneOverride: false,
		proposalReason: '근로자의 안전보건과 근로 환경 개선을 위한 제도적 장치를 마련하기 위함.'
	},
	{
		num: 2210006,
		subject: '부패방지 및 국민권익위원회의 운영에 관한 법률안',
		committee: '법제사법위원회',
		archiveDaysAgo: 8,
		isDoneOverride: true,
		proposalReason: '공공기관의 부패 예방과 투명한 행정을 강화하기 위함.'
	},
	{
		num: 2210007,
		subject: '학교폭력 예방 및 대책에 관한 법률안',
		committee: '교육위원회',
		archiveDaysAgo: 2,
		isDoneOverride: false,
		proposalReason: '학교폭력 예방 교육의 실효성을 높이고 피해 학생 보호를 강화하기 위함.'
	},
	{
		num: 2210008,
		subject: '전자상거래 소비자보호에 관한 법률안',
		committee: '정무위원회',
		archiveDaysAgo: 15,
		isDoneOverride: true,
		proposalReason: '전자상거래 시장에서의 소비자 권익 보호를 강화하기 위함.'
	},
	{
		num: 2210009,
		subject: ' Renewable Energy法案',
		committee: '산업통상자원중소벤처기업위원회',
		archiveDaysAgo: 7,
		isDoneOverride: false,
		proposalReason: '재생에너지 산업의 경쟁력 강화와 에너지 전환 정책 지원을 위함.'
	},
	{
		num: 2210010,
		subject: '국가재정법 일부개정법률안',
		committee: '기획재정위원회',
		archiveDaysAgo: 12,
		isDoneOverride: true,
		proposalReason: '국가 재정 운용의 투명성과 책임성을 강화하기 위함.'
	},
	{
		num: 2210011,
		subject: '화학물질 관리법 일부개정법률안',
		committee: '환경노동위원회',
		archiveDaysAgo: 4,
		isDoneOverride: false,
		proposalReason: '유해 화학물질의 안전 관리 체계를 강화하기 위함.'
	},
	{
		num: 2210012,
		subject: '금융소비자 보호에 관한 법률안',
		committee: '정무위원회',
		archiveDaysAgo: 6,
		isDoneOverride: true,
		proposalReason: '금융거래에서의 소비자 보호 제도를 선진화하기 위함.'
	}
];

function buildMockArchiveNotices(): Notice[] {
	return MOCK_ARCHIVE_OVERRIDE_CONFIG.map((override) => {
		const record = buildMockNoticeRecord(override.num);
		const { notice } = record;
		const archiveStartedAt = daysAgo(override.archiveDaysAgo);
		const isDone = override.isDoneOverride ?? notice.isDone;

		// Override lifecycleStatus based on isDoneOverride for correct filter behavior.
		const lifecycleStatus: NoticeLifecycleStatus =
			override.isDoneOverride === true
				? 'renumbered'
				: override.isDoneOverride === false
					? 'active'
					: (notice.lifecycleStatus ?? 'active');

		return {
			num: override.num,
			subject: override.subject,
			proposerCategory: notice.proposerCategory,
			committee: override.committee,
			link: notice.link,
			isDone,
			archiveStartedAt,
			lastUpdatedAt: notice.lastUpdatedAt,
			aiSummary: notice.aiSummary,
			aiSummaryStatus: notice.aiSummaryStatus,
			lifecycleStatus,
			sourceDeletedAt: notice.sourceDeletedAt,
			contentId: notice.contentId,
			changeEventCount: record.changes.count,
			attachments: notice.attachments
		};
	});
}

export function getMockRecentNotices(): Notice[] {
	return buildMockArchiveNotices().slice(0, 3);
}

export function getMockQuickKeywordSuggestions(): QuickKeywordSuggestionsResponse {
	return {
		items: [
			{ keyword: '중대재해', score: 8.4, matchCount: 3 },
			{ keyword: 'AI', score: 7.8, matchCount: 3 },
			{ keyword: '개인정보', score: 6.9, matchCount: 2 },
			{ keyword: '플랫폼', score: 5.8, matchCount: 2 },
			{ keyword: '근로기준', score: 5.1, matchCount: 2 }
		],
		updatedAt: hoursAgo(1),
		sourceNoticeCount: 12,
		refreshIntervalMs: 60 * 60 * 1000
	};
}

export function getMockArchiveNoticesResponse(params: {
	page: number;
	limit: number;
	search?: string;
	proposer?: string;
	startDate?: string;
	endDate?: string;
	sortOrder?: 'asc' | 'desc';
	isDone?: boolean;
	fullText?: boolean;
}): ArchiveNoticeListResponse {
	const allNotices = buildMockArchiveNotices();
	const search = (params.search || '').trim().toLowerCase();
	const proposerFilter = (params.proposer || '').trim().toLowerCase();
	const fullText = params.fullText === true;

	// Build a map of num → proposalReason for fullText search expansion.
	const proposalReasonMap = new Map<number, string>();
	for (const config of MOCK_ARCHIVE_OVERRIDE_CONFIG) {
		if (config.proposalReason) {
			proposalReasonMap.set(config.num, config.proposalReason.toLowerCase());
		}
	}

	let filtered = [...allNotices];

	if (search) {
		filtered = filtered.filter((notice) => {
			const baseHaystack = [
				notice.subject,
				notice.committee,
				notice.proposerCategory,
				notice.contentId
			]
				.join(' ')
				.toLowerCase();
			if (fullText) {
				const proposalReason = proposalReasonMap.get(notice.num) || '';
				return baseHaystack.includes(search) || proposalReason.includes(search);
			}
			return baseHaystack.includes(search);
		});
	}

	if (proposerFilter) {
		filtered = filtered.filter((notice) => {
			const haystack = [notice.subject, notice.proposerCategory].join(' ').toLowerCase();
			return haystack.includes(proposerFilter);
		});
	}

	// Apply date range filtering based on archiveStartedAt.
	if (params.startDate) {
		const startMs = new Date(params.startDate).getTime();
		filtered = filtered.filter((notice) => {
			if (!notice.archiveStartedAt) return false;
			return new Date(notice.archiveStartedAt).getTime() >= startMs;
		});
	}
	if (params.endDate) {
		const endMs = new Date(params.endDate + 'T23:59:59').getTime();
		filtered = filtered.filter((notice) => {
			if (!notice.archiveStartedAt) return false;
			return new Date(notice.archiveStartedAt).getTime() <= endMs;
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
		proposer: params.proposer ?? '',
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

function getMockDiscussionThreadId(noticeNum: number): number {
	return noticeNum * 100 + 1;
}

function getNoticeNumFromMockThreadId(threadId: number): number {
	return threadId > 100 ? Math.floor((threadId - 1) / 100) : 2210001;
}

function buildMockDiscussionComments(threadId: number, noticeNum: number) {
	return Array.from({ length: 54 }, (_, index) => {
		const sequence = index + 1;
		const isSystemMessage = sequence % 17 === 0;
		return {
			id: threadId * 1000 + sequence,
			threadId,
			noticeNum,
			sequence,
			messageType: isSystemMessage ? DiscussionMessageType.SYSTEM : DiscussionMessageType.USER,
			authorNickname: isSystemMessage ? 'LawCast' : sequence % 3 === 0 ? '익명 정책검토자' : '익명',
			authorIpMasked: isSystemMessage ? '' : `127.0.${sequence % 10}.***`,
			content:
				sequence === 1
					? '모의 토론 시작 의견입니다.'
					: sequence % 9 === 0
						? `>>#${sequence - 2}\n앞선 의견을 바탕으로 조문 적용 범위와 시행 시점을 함께 검토해야 한다고 봅니다. mock 의견 #${sequence}입니다.`
						: isSystemMessage
							? `토론 상태 확인용 시스템 메시지입니다. mock 의견 #${sequence}입니다.`
							: `무한 로딩 검증을 위한 mock 의견 #${sequence}입니다. 스크롤하면 다음 의견 묶음이 순서대로 추가됩니다.`,
			isDeleted: sequence % 23 === 0,
			isEdited: sequence % 11 === 0,
			editedAt: sequence % 11 === 0 ? hoursAgo(Math.max(1, 60 - sequence)) : null,
			createdAt: hoursAgo(Math.max(1, 60 - sequence)),
			updatedAt: hoursAgo(Math.max(1, 60 - sequence))
		};
	});
}

export function getMockNoticeDiscussions(noticeNum: number): DiscussionThreadListResponse {
	const threadId = getMockDiscussionThreadId(noticeNum);
	const commentCount = buildMockDiscussionComments(threadId, noticeNum).length;

	return {
		items: [
			{
				id: threadId,
				noticeNum,
				title: '모의 토론 주제',
				status: DiscussionThreadStatus.OPEN,
				isLocked: false,
				authorNickname: '익명',
				authorIpMasked: '127.0.***.***',
				commentCount,
				createdAt: hoursAgo(2),
				updatedAt: hoursAgo(1)
			}
		],
		total: 1,
		page: 1,
		limit: 20
	};
}

export function getMockAllDiscussionThreads(): DiscussionThreadWithNoticeListResponse {
	const mockNoticeNum = 2210001;
	const threadId = getMockDiscussionThreadId(mockNoticeNum);
	const commentCount = buildMockDiscussionComments(threadId, mockNoticeNum).length;

	return {
		items: [
			{
				id: threadId,
				noticeNum: mockNoticeNum,
				title: '모의 토론 주제',
				status: DiscussionThreadStatus.OPEN,
				isLocked: false,
				authorNickname: '익명',
				authorIpMasked: '127.0.***.***',
				commentCount,
				createdAt: hoursAgo(2),
				updatedAt: hoursAgo(1),
				noticeSubject: '모의 법률안 제목'
			}
		],
		total: 1,
		page: 1,
		limit: 20
	};
}

export function getMockDiscussionThread(
	threadId: number,
	noticeNum?: number,
	params: { cursor?: number; limit?: number } = {}
): DiscussionThreadDetailResponse {
	const resolvedNoticeNum = noticeNum ?? getNoticeNumFromMockThreadId(threadId);
	const allComments = buildMockDiscussionComments(threadId, resolvedNoticeNum);
	const safeCursor = Math.max(0, params.cursor ?? 0);
	const safeLimit = Math.max(1, Math.min(100, params.limit ?? 20));
	const comments = allComments
		.filter((comment) => comment.sequence > safeCursor)
		.slice(0, safeLimit);
	const lastSequence = comments[comments.length - 1]?.sequence ?? null;

	return {
		thread: {
			id: threadId,
			noticeNum: resolvedNoticeNum,
			title: '모의 토론 주제',
			status: DiscussionThreadStatus.OPEN,
			isLocked: false,
			authorNickname: '익명',
			authorIpMasked: '127.0.***.***',
			commentCount: allComments.length,
			createdAt: hoursAgo(2),
			updatedAt: hoursAgo(1)
		},
		comments,
		hasMore:
			lastSequence !== null && allComments.some((comment) => comment.sequence > lastSequence),
		nextCursor: lastSequence
	};
}

export function getMockRecentNoticeChangesResponse(params: {
	page: number;
	limit: number;
	search?: string;
	noticeNum?: number;
	eventType?: 'updated' | 'invalidated';
	sortOrder?: 'asc' | 'desc';
	excludeIsDoneEvents?: boolean;
}): RecentNoticeChangesResponse {
	const normalizedSearch = (params.search || '').trim().toLowerCase();
	const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

	const merged = [2210001, 2210002, 2210003, 2210004]
		.flatMap((noticeNum) => {
			const record = buildMockNoticeRecord(noticeNum);
			if (params.excludeIsDoneEvents === true && record.notice.isDone) {
				return [];
			}

			return record.changes.items.map((item) => ({
				...item,
				subject: record.notice.subject
			}));
		})
		.filter((item) => item.eventType !== 'created')
		.filter((item) => (params.noticeNum ? item.noticeNum === params.noticeNum : true))
		.filter((item) => (params.eventType ? item.eventType === params.eventType : true))
		.filter((item) => {
			if (params.excludeIsDoneEvents !== true) {
				return true;
			}

			return item.details.some((detail) => detail.fieldPath === 'isDone') === false;
		})
		.filter((item) => {
			if (!normalizedSearch) {
				return true;
			}

			const haystack = `${item.noticeNum} ${item.subject || ''}`.toLowerCase();
			return haystack.includes(normalizedSearch);
		})
		.sort((a, b) => {
			const timeDiff = new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
			if (timeDiff === 0) {
				return a.id - b.id;
			}
			return timeDiff;
		});

	if (sortOrder === 'desc') {
		merged.reverse();
	}

	const total = merged.length;
	const page = Math.max(1, params.page);
	const limit = Math.max(1, Math.min(50, params.limit));
	const start = (page - 1) * limit;

	return {
		items: merged.slice(start, start + limit),
		page,
		limit,
		total,
		totalPages: Math.max(1, Math.ceil(total / limit))
	};
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
		webPush: {
			total: 3,
			active: 2,
			inactive: 1,
			withFailures: 1
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
		changeTracking: {
			comparableEventTotal: 8,
			comparableNoticeCount: 3
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
		aiSummaryEnabled: true,
		crawlers: {
			palCrawler: {
				name: '국회 입법예고 크롤러 (PAL)',
				source: 'pal.assembly.go.kr',
				status: 'idle',
				lastRunAt: hoursAgo(0.15),
				lastError: null,
				cron: { expression: '2-59/10 * * * *', intervalMs: 600000, description: '매 10분' }
			},
			nsmPendingCrawler: {
				name: '국민참여입법센터 크롤러 (NSM)',
				source: 'opinion.lawmaking.go.kr',
				status: 'idle',
				lastRunAt: hoursAgo(0.2),
				lastError: null,
				cron: { expression: '6-59/20 * * * *', intervalMs: 1200000, description: '매 20분' }
			},
			archiveSync: {
				isRunning: false,
				runningPhases: [],
				phases: [
					{ name: 'full sync', status: 'completed', lastRunAt: hoursAgo(2), lastError: null },
					{ name: 'pending sync', status: 'completed', lastRunAt: hoursAgo(1.5), lastError: null },
					{ name: 'isDone sync', status: 'completed', lastRunAt: hoursAgo(2), lastError: null },
					{
						name: 'summary backfill',
						status: 'completed',
						lastRunAt: hoursAgo(1),
						lastError: null
					},
					{
						name: 'integrity rescan',
						status: 'completed',
						lastRunAt: hoursAgo(10),
						lastError: null
					}
				],
				asyncApply: null
			},
			cronJobs: [
				{
					name: 'crawling and notification',
					status: 'idle',
					lastRunAt: hoursAgo(0.15),
					lastError: null,
					cron: { expression: '2-59/10 * * * *', intervalMs: 600000, description: '매 10분' }
				},
				{
					name: 'pending bills crawl (NsmLmSts)',
					status: 'idle',
					lastRunAt: hoursAgo(0.2),
					lastError: null,
					cron: { expression: '6-59/20 * * * *', intervalMs: 1200000, description: '매 20분' }
				},
				{
					name: 'proposalReason backfill drain',
					status: 'idle',
					lastRunAt: hoursAgo(0.3),
					lastError: null,
					cron: { expression: '9-59/15 * * * *', intervalMs: 900000, description: '매 15분' }
				},
				{
					name: 'isDone sync',
					status: 'idle',
					lastRunAt: hoursAgo(2),
					lastError: null,
					cron: { expression: '13 */6 * * *', intervalMs: 21600000, description: '6시간마다' }
				},
				{
					name: 'webhook cleanup',
					status: 'idle',
					lastRunAt: hoursAgo(20),
					lastError: null,
					cron: { expression: '1 0 * * *', intervalMs: 86400000, description: '매일' }
				},
				{
					name: 'webhook optimization',
					status: 'idle',
					lastRunAt: hoursAgo(22),
					lastError: null,
					cron: { expression: '1 2 * * *', intervalMs: 86400000, description: '매일' }
				},
				{
					name: 'system monitoring',
					status: 'idle',
					lastRunAt: hoursAgo(0.5),
					lastError: null,
					cron: { expression: '0 * * * *', intervalMs: 3600000, description: '매시간' }
				},
				{
					name: 'snapshot artifact backfill',
					status: 'idle',
					lastRunAt: hoursAgo(10),
					lastError: null,
					cron: { expression: '43 3 * * *', intervalMs: 86400000, description: '매일' }
				},
				{
					name: 'integrity re-scan',
					status: 'idle',
					lastRunAt: hoursAgo(10),
					lastError: null,
					cron: { expression: '43 3 * * *', intervalMs: 86400000, description: '매일' }
				},
				{
					name: 'change-tracking daily audit',
					status: 'idle',
					lastRunAt: hoursAgo(9),
					lastError: null,
					cron: { expression: '7 4 * * *', intervalMs: 86400000, description: '매일' }
				},
				{
					name: 'change-tracking weekly audit',
					status: 'idle',
					lastRunAt: hoursAgo(48),
					lastError: null,
					cron: { expression: '19 4 * * 1', intervalMs: 604800000, description: '매주' }
				},
				{
					name: 'quick keyword refresh',
					status: 'idle',
					lastRunAt: hoursAgo(0.5),
					lastError: null,
					cron: { expression: '11 * * * *', intervalMs: 3600000, description: '매시간' }
				},
				{
					name: 'sqlite vacuum',
					status: 'idle',
					lastRunAt: hoursAgo(96),
					lastError: null,
					cron: { expression: '31 5 * * 0', intervalMs: 604800000, description: '매주' }
				},
				{
					name: 'database mirror upload',
					status: 'idle',
					lastRunAt: hoursAgo(15),
					lastError: null,
					cron: { expression: '0 8 * * *', intervalMs: 86400000, description: '매일' }
				}
			]
		}
	};
}

export function getMockCrawlingTransparencyData(): CrawlingTransparencyData {
	return {
		noticeSources: [
			{
				id: 'pal',
				name: '국회 입법예고 게시판',
				url: 'https://pal.assembly.go.kr',
				description: '국회에서 발의된 법률안과 입법예고 정보를 수집합니다.',
				noticeCount: 12,
				intervalMs: 600000,
				intervalLabel: '매 10분'
			},
			{
				id: 'nsm',
				name: '국민참여입법센터 입법진행현황',
				url: 'https://opinion.lawmaking.go.kr',
				description: '국민참여입법센터의 입법진행현황(국회입법현황)을 수집합니다.',
				noticeCount: 4,
				intervalMs: 1200000,
				intervalLabel: '매 20분'
			}
		],
		collection: {
			totalNotices: 12,
			byLifecycle: { active: 6, renumbered: 4, source_deleted: 2 },
			bySource: { pal: 12, nsm: 4 }
		},
		changeTracking: {
			totalEvents: 36,
			byType: { created: 12, updated: 18, invalidated: 6 }
		},
		schedules: [
			{
				id: 'pal-crawl',
				name: '입법예고 크롤링',
				intervalMs: 600000,
				intervalLabel: '매 10분',
				description: '국회 입법예고 게시판에서 새 의안을 수집합니다.'
			},
			{
				id: 'nsm-crawl',
				name: '국민참여입법센터 크롤링',
				intervalMs: 1200000,
				intervalLabel: '매 20분',
				description: '국민참여입법센터에서 입법진행현황을 수집합니다.'
			}
		],
		transferFlow: {
			description:
				'국민참여입법센터의 입법진행현황에서 국회입법현황으로 이관된 의안이 있으면, 크롤러가 이를 자동으로 감지하여 동기화합니다.',
			nsmToPalIndicator:
				'국회입법현황에서 의안으로 등록된 경우, 크롤러가 자동으로 동기화하여 관리합니다.'
		}
	};
}

export function getMockProposalStatisticsData(params: {
	granularity?: string;
}): ProposalStatisticsData {
	const granularity = (params.granularity as ProposalStatisticsGranularity) || 'daily';
	const buckets = Array.from({ length: 14 }, (_, i) => ({
		period: `2026-09-${String(i + 1).padStart(2, '0')}`,
		count: Math.floor(Math.random() * 5) + 1
	}));

	return {
		granularity,
		startDate: '2026-09-01',
		endDate: '2026-09-14',
		totalCount: buckets.reduce((sum, b) => sum + b.count, 0),
		buckets
	};
}
