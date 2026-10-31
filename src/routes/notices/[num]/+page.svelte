<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import RateLimitOverlay from '$lib/components/RateLimitOverlay.svelte';
	import { openExternalLink } from '$lib/utils/helpers';
	import { buildOpinionSubmissionUrlForContentId } from '$lib/utils/opinion-submission-url.util';
	import { afterNavigate, goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { onDestroy, tick, untrack } from 'svelte';
	import { apiClient } from '$lib/api/client';
	import {
		mergeRevisionHistory,
		revisionHistoryCursor,
		validateOlderRevisionPage,
		REVISION_HISTORY_PAGE_SIZE
	} from '$lib/utils/revision-history';
	import NoticeChangeTimeline from '$lib/components/NoticeChangeTimeline.svelte';
	import { fade, slide } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBell,
		faCheck,
		faChevronDown,
		faClock,
		faComments,
		faDownload,
		faFingerprint,
		faExternalLink,
		faFileLines,
		faImage,
		faLock,
		faPaperPlane,
		faScaleBalanced,
		faShieldHalved,
		faShareNodes,
		faRotate,
		faTriangleExclamation,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import type {
		NoticeDetail,
		NoticeChangeTimelineResponse,
		DiscussionThreadListResponse
	} from '$lib/types/api';
	import { RetryCountdown } from '$lib/utils/retry-countdown.util';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { buildRevisionSnapshots, compareRevisionSnapshots } from '$lib/utils/revision-comparison';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import {
		buildNoticeDeadline,
		formatNoticeDeadlineSuffix,
		type NoticeDeadline
	} from '$lib/utils/notice-deadline.util';
	import NoticeDiscussions from '$lib/components/discussions/NoticeDiscussions.svelte';
	import NoticeScreenshot from '$lib/components/NoticeScreenshot.svelte';

	let {
		data
	}: {
		data: {
			detail: NoticeDetail;
			changes: NoticeChangeTimelineResponse;
			changesLoadError?: string;
			discussions?: DiscussionThreadListResponse;
			discussionError?: {
				status: number;
				message: string;
				retryAfter?: number;
			};
			loadError?: {
				message: string;
				retryAfter?: number;
			};
		};
	} = $props();

	let detail = $derived(data.detail);
	let historyOwner = $state<number | null>(null);
	let historyItems = $state.raw<NoticeChangeTimelineResponse['items']>([]);
	let historyHasMore = $state(false);
	let historyBeforeHeight = $state<number | null>(null);
	let historyLoading = $state(false);
	let historyPageError = $state('');
	let historyGeneration = 0;
	let historyController: AbortController | null = null;
	let changes = $derived(
		historyOwner === detail.notice.num
			? {
					noticeNum: historyOwner,
					items: historyItems,
					count: historyItems.length,
					hasMore: historyHasMore,
					nextBeforeHeight: historyBeforeHeight
				}
			: data.changes
	);

	$effect(() => {
		const noticeNum = detail.notice.num;
		const initial = data.changes;
		untrack(() => {
			if (historyOwner !== noticeNum) {
				historyGeneration++;
				historyController?.abort();
				historyOwner = noticeNum;
				historyItems = mergeRevisionHistory([], initial.items);
				historyLoading = false;
				historyPageError = '';
				const cursor = revisionHistoryCursor(initial);
				historyHasMore = cursor.hasMore;
				historyBeforeHeight = cursor.nextBeforeHeight;
			} else {
				const oldMinimum = historyItems.at(-1)?.eventHeight ?? Infinity;
				const initialMinimum = initial.items.length
					? Math.min(...initial.items.map((item) => item.eventHeight))
					: Infinity;
				historyItems = mergeRevisionHistory(historyItems, initial.items);
				// Preserve older pages when a historical view or refresh reruns the SSR loader.
				if (oldMinimum >= initialMinimum) {
					const cursor = revisionHistoryCursor(initial);
					historyHasMore = cursor.hasMore;
					historyBeforeHeight = cursor.nextBeforeHeight;
				}
			}
		});
	});

	onDestroy(() => historyController?.abort());

	async function loadOlderHistory(): Promise<void> {
		if (
			historyLoading ||
			!historyHasMore ||
			historyBeforeHeight === null ||
			historyOwner !== detail.notice.num
		)
			return;
		const noticeNum = historyOwner;
		const beforeHeight = historyBeforeHeight;
		const generation = historyGeneration;
		const originalUrl = page.url.href;
		const focusedControl =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const controller = new AbortController();
		historyController = controller;
		historyLoading = true;
		historyPageError = '';
		try {
			const next = await apiClient.getNoticeChanges(noticeNum, {
				limit: REVISION_HISTORY_PAGE_SIZE,
				beforeHeight,
				signal: controller.signal
			});
			if (
				generation !== historyGeneration ||
				detail.notice.num !== noticeNum ||
				controller.signal.aborted
			)
				return;
			const cursor = validateOlderRevisionPage(next, noticeNum, beforeHeight);
			historyItems = mergeRevisionHistory(historyItems, next.items);
			historyHasMore = cursor.hasMore;
			historyBeforeHeight = cursor.nextBeforeHeight;
		} catch {
			if (
				generation === historyGeneration &&
				detail.notice.num === noticeNum &&
				!controller.signal.aborted
			) {
				historyPageError =
					'이전 기록을 불러오지 못했습니다. 기존 기록은 그대로 유지됩니다. 다시 시도해주세요.';
			}
		} finally {
			if (generation === historyGeneration) {
				historyLoading = false;
				await tick();
				if (page.url.href === originalUrl && document.activeElement === document.body) {
					if (focusedControl?.isConnected) focusedControl.focus({ preventScroll: true });
					else if (focusedControl?.dataset.testid?.startsWith('revision-history-load-older')) {
						document
							.querySelector<HTMLElement>('[data-testid="revision-history-complete"]')
							?.focus({ preventScroll: true });
					}
				}
			}
			if (historyController === controller) historyController = null;
		}
	}
	let loadError = $derived(data.loadError);
	let aiSummaryEnabled = $derived(detail.aiSummaryEnabled !== false);

	let countdown = $state(0);
	let isRetrying = $state(false);
	const retry = new RetryCountdown(
		() => invalidateAll(),
		(v) => {
			countdown = v;
		},
		(v) => {
			isRetrying = v;
		}
	);
	onDestroy(() => retry.destroy());

	$effect(() => {
		if (loadError !== retry.lastSeenError) {
			retry.lastSeenError = loadError;
			if (loadError?.retryAfter && loadError.retryAfter > 0) {
				retry.start(loadError.retryAfter);
			} else {
				retry.stop();
			}
		}
	});

	// Must be $state: every URL-derived value below (compare selection, timeline
	// query flags, revision links, back link) recomputes only when this updates
	// after client-side navigation. A plain let stays stale forever in runes mode.
	let currentUrl = $state(page.url);
	afterNavigate(() => {
		currentUrl = page.url;
		const token = ++timelineScrollToken;
		// Comparison controls explicitly preserve the user's current reading position.
		if (!comparisonPending) void scrollToRequestedHistory(page.url, token);
	});

	function buildExcerpt(content: string, maxLength = 180): string {
		const normalized = content.replace(/\s+/g, ' ').trim();

		if (normalized.length <= maxLength) {
			return normalized;
		}

		return `${normalized.slice(0, maxLength)}...`;
	}

	function formatDateTime(value: string | null): string {
		return formatDateTimeKST(value);
	}

	type DisplayContent = {
		title: string;
		proposalReason: string;
		billNumber: string | null;
		proposer: string | null;
		proposerCategory: string | null;
		proposalDate: string | null;
		committee: string | null;
		referralDate: string | null;
		noticePeriod: string | null;
		proposalSession: string | null;
		isDone: boolean | null;
		lifecycleStatus: string | null;
		sourceDeletedAt: string | null;
	};

	function buildDisplayContentFromDetail(input: NoticeDetail): DisplayContent {
		return {
			title: input.notice.subject,
			proposalReason: input.originalContent.proposalReason,
			billNumber: input.originalContent.billNumber,
			proposer: input.originalContent.proposer,
			proposerCategory: input.notice.proposerCategory,
			proposalDate: input.originalContent.proposalDate,
			committee: input.originalContent.committee ?? input.notice.committee,
			referralDate: input.originalContent.referralDate,
			noticePeriod: input.originalContent.noticePeriod,
			proposalSession: input.originalContent.proposalSession,
			isDone: input.notice.isDone ?? null,
			lifecycleStatus: input.notice.lifecycleStatus ?? null,
			sourceDeletedAt: input.notice.sourceDeletedAt ?? null
		};
	}

	let displayContent = $derived(buildDisplayContentFromDetail(detail));
	// D-day/deadline chip payload parsed from the raw notice-period string.
	let deadline = $derived(
		buildNoticeDeadline(displayContent.noticePeriod, displayContent.isDone ?? null)
	);
	let opinionGuidance = $derived(
		displayContent.noticePeriod
			? `입법예고 기간(의견 제출 가능 기간: ${displayContent.noticePeriod})`
			: '입법예고 기간(의견 제출 가능 기간)'
	);
	// Before the transfer to the National Assembly legislative notice (the
	// contentId added event), the bill lives only in the bill information
	// system, which has no citizen opinion collection page. Keep the opinion
	// CTA disabled until a contentId exists.
	let opinionContentId = $derived(
		(detail.notice.contentId ?? detail.originalContent.contentId ?? '').trim()
	);
	let hasOpinionTarget = $derived(opinionContentId.length > 0);
	let isPreTransfer = $derived(!loadError && !hasOpinionTarget);
	let opinionGuidanceText = $derived(
		displayContent.isDone
			? `${opinionGuidance}이 종료되어 더 이상 의견을 제출할 수 없습니다.`
			: isPreTransfer
				? `${opinionGuidance}이지만, 아직 국회 입법예고로 이관되기 전이라 의안정보시스템에는 시민 의견 수렴 페이지가 없어 의견을 제출할 수 없습니다. 입법예고로 이관되면 의견 제출이 가능합니다.`
				: `${opinionGuidance}에는 누구나 국회 홈페이지에서 의견을 제출할 수 있습니다.`
	);

	/** "2026-06-14 ~ 2026-06-28 · 2026-06-28 마감 (D-3)" combined display style for the facts row. */
	function withDeadlineSuffix(period: string | null, deadline: NoticeDeadline): string | null {
		if (!period) {
			return period;
		}
		const suffix = formatNoticeDeadlineSuffix(deadline);
		return suffix ? `${period} · ${suffix}` : period;
	}
	let pageTitle = $derived(`${displayContent.title} - 제안이유 및 주요내용 원문`);
	let pageDescription = $derived(
		buildExcerpt(
			aiSummaryEnabled
				? (detail.notice.aiSummary ?? displayContent.proposalReason)
				: displayContent.proposalReason
		)
	);

	function safeJsonLd(data: object): string {
		return JSON.stringify(data)
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e')
			.replace(/&/g, '\\u0026');
	}

	let pageUrl = $derived(currentUrl.origin + currentUrl.pathname);
	let publishedTime = $derived(
		detail.archiveMetadata.archivedAt ?? detail.notice.archiveStartedAt ?? null
	);
	let modifiedTime = $derived(detail.notice.lastUpdatedAt ?? publishedTime);
	let pageKeywords = $derived(
		[
			displayContent.title,
			displayContent.committee,
			displayContent.proposer,
			displayContent.billNumber,
			'입법예고',
			'국회 법률안',
			'제안이유 및 주요내용',
			'법률안 원문',
			'의안번호'
		]
			.filter(Boolean)
			.join(', ')
	);
	let articleJsonLd = $derived(
		safeJsonLd({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'BreadcrumbList',
					itemListElement: [
						{ '@type': 'ListItem', position: 1, name: '홈', item: `${currentUrl.origin}/` },
						{
							'@type': 'ListItem',
							position: 2,
							name: '전체 입법예고',
							item: `${currentUrl.origin}/notices`
						},
						{
							'@type': 'ListItem',
							position: 3,
							name: detail.notice.subject,
							item: pageUrl
						}
					]
				},
				{
					'@type': 'Article',
					headline: displayContent.title,
					description: pageDescription,
					url: pageUrl,
					...(publishedTime ? { datePublished: publishedTime } : {}),
					...(modifiedTime ? { dateModified: modifiedTime } : {}),
					author: displayContent.proposer
						? { '@type': 'Organization', name: displayContent.proposer }
						: undefined,
					publisher: { '@type': 'Organization', name: 'LawCast' },
					inLanguage: 'ko',
					isPartOf: { '@type': 'WebSite', name: 'LawCast', url: `${currentUrl.origin}/` }
				}
			]
		})
	);

	let shouldShowAIBriefing = $derived(
		aiSummaryEnabled &&
			(detail.notice.aiSummaryStatus === 'ready' || detail.notice.aiSummaryStatus === 'unavailable')
	);
	let integrityStatus = $derived(
		detail.archiveMetadata.integrity.status ??
			(detail.archiveMetadata.integrity.passed === true
				? 'passed'
				: detail.archiveMetadata.integrity.passed === false
					? 'failed'
					: 'pending')
	);
	let integrityStatusLabel = $derived(
		integrityStatus === 'passed'
			? '검증 통과'
			: integrityStatus === 'failed'
				? '검증 실패'
				: integrityStatus === 'skipped'
					? '검증 스킵'
					: '검증 대기'
	);
	let lifecycleStatus = $derived(displayContent.lifecycleStatus ?? 'active');
	let isSourceDeleted = $derived(lifecycleStatus === 'source_deleted');
	let isRenumbered = $derived(lifecycleStatus === 'renumbered');

	let contentFacts = $derived(
		[
			{ label: '의안번호', value: displayContent.billNumber },
			// Remove unnecessary prefix from proposer field if present
			{ label: '제안자', value: displayContent.proposer?.replace('제안자목록', '').trim() },
			{ label: '제안일', value: displayContent.proposalDate },
			{ label: '소관위원회', value: displayContent.committee },
			{ label: '회부일', value: displayContent.referralDate },
			{
				label: '입법예고기간',
				value: withDeadlineSuffix(displayContent.noticePeriod, deadline)
			},
			{ label: '제안회기', value: displayContent.proposalSession }
		].filter((item) => !!item.value)
	);

	let pageParam = $derived(currentUrl.searchParams.get('page'));
	let limitParam = $derived(currentUrl.searchParams.get('limit'));
	let searchParam = $derived(currentUrl.searchParams.get('search'));
	let startDateParam = $derived(currentUrl.searchParams.get('startDate'));
	let endDateParam = $derived(currentUrl.searchParams.get('endDate'));
	let sortOrderParam = $derived(currentUrl.searchParams.get('sortOrder'));
	let currentRevision = $derived(detail.revision);
	let headRevision = $derived(currentRevision?.headRev ?? null);
	let activeRevision = $derived(currentRevision?.resolvedRev ?? null);
	let isHistoricalView = $derived(currentRevision?.isHistorical ?? false);
	let activeRevisionForUi = $derived(activeRevision ?? headRevision);
	let hasLegacyGenesisBoundary = $derived(currentRevision?.hasLegacyGenesisBoundary ?? false);
	let legacyGenesisBoundaryAt = $derived(currentRevision?.legacyGenesisBoundaryAt ?? null);

	let backLink = $derived(
		(() => {
			const params = new SvelteURLSearchParams();
			if (pageParam) params.set('page', pageParam);
			if (limitParam) params.set('limit', limitParam);
			if (searchParam) params.set('search', searchParam);
			if (startDateParam) params.set('startDate', startDateParam);
			if (endDateParam) params.set('endDate', endDateParam);
			if (sortOrderParam) params.set('sortOrder', sortOrderParam);
			const query = params.toString();
			return query ? `/notices?${query}` : '/notices';
		})()
	);

	let isArchiveMetaOpen = $state(false);
	let isScreenshotExpanded = $state(false);
	let isExportingArchive = $state(false);
	let shareState: 'idle' | 'copied' = $state('idle');
	let exportArchiveError: string | null = $state(null);
	let timelineSectionElement: HTMLElement | null = null;
	let timelineScrollToken = 0;
	let timelineVisibilityRequests = 0;
	onDestroy(() => timelineScrollToken++);

	async function scrollToRequestedHistory(url: URL, token: number): Promise<void> {
		const wantsComparison = ['cmpFrom', 'cmpTo', 'cmpShowAll'].some((key) =>
			url.searchParams.has(key)
		);
		if (
			(!wantsComparison && parseBooleanParam(url.searchParams.get('timeline')) !== true) ||
			(url.hash && !['#change-tracking-timeline', '#revision-comparison'].includes(url.hash))
		)
			return;

		isChangeTimelineOpen = true;
		await tick();
		const section = timelineSectionElement;
		if (!section) return;
		// Deferred, offscreen content can pause its disclosure animations indefinitely.
		timelineVisibilityRequests++;
		section.style.contentVisibility = 'visible';
		try {
			await Promise.all(
				section
					.getAnimations({ subtree: true })
					.filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
					.map((animation) => animation.finished.catch(() => {}))
			);
		} finally {
			timelineVisibilityRequests--;
			if (timelineVisibilityRequests === 0) section.style.removeProperty('content-visibility');
		}
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
		if (token !== timelineScrollToken || page.url.href !== url.href || !section.isConnected) return;
		const target = wantsComparison
			? (section.querySelector<HTMLElement>('#revision-comparison') ?? section)
			: section;
		const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
		// Scroll the document only after restoring deferred rendering and clearing slide clips.
		window.scrollTo({
			left: 0,
			top: scrollY + target.getBoundingClientRect().top - margin,
			behavior: 'instant'
		});
	}

	function parseBooleanParam(value: string | null): boolean | null {
		if (!value) {
			return null;
		}

		const normalized = value.trim().toLowerCase();
		if (['1', 'true', 'yes', 'on', 'open'].includes(normalized)) {
			return true;
		}

		if (['0', 'false', 'no', 'off', 'close', 'closed'].includes(normalized)) {
			return false;
		}

		return null;
	}

	function getArchiveFileName(contentDisposition: string | null, noticeNum: number): string {
		const fallbackName = `notice-${noticeNum}-archive.zip`;

		if (!contentDisposition) {
			return fallbackName;
		}

		const encodedNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
		if (encodedNameMatch?.[1]) {
			try {
				return decodeURIComponent(encodedNameMatch[1]);
			} catch {
				return encodedNameMatch[1];
			}
		}

		const plainNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
		if (plainNameMatch?.[1]) {
			return plainNameMatch[1];
		}

		return fallbackName;
	}

	async function downloadArchiveZip(): Promise<void> {
		if (isExportingArchive) {
			return;
		}

		isExportingArchive = true;
		exportArchiveError = null;

		try {
			const response = await fetch(`/api/notices/${detail.notice.num}/export`, {
				method: 'GET',
				headers: {
					Accept: 'application/zip'
				}
			});

			if (!response.ok) {
				throw new Error('ZIP 파일을 준비하지 못했습니다.');
			}

			const zipBlob = await response.blob();
			const blobUrl = URL.createObjectURL(zipBlob);
			const fileName = getArchiveFileName(
				response.headers.get('content-disposition'),
				detail.notice.num
			);

			const downloadLink = document.createElement('a');
			downloadLink.href = blobUrl;
			downloadLink.download = fileName;
			document.body.appendChild(downloadLink);
			downloadLink.click();
			downloadLink.remove();
			URL.revokeObjectURL(blobUrl);
		} catch {
			exportArchiveError = '자료 반출 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.';
		} finally {
			isExportingArchive = false;
		}
	}

	async function shareNotice(): Promise<void> {
		const text = [
			detail.notice.aiSummary,
			'LawCast에서 법률안 상세 내용을 확인하고 토론에 참여해보세요.'
		].join('\n');
		const shareData = {
			title: pageTitle,
			url: pageUrl,
			text
		};

		if (navigator.share && navigator.canShare?.(shareData)) {
			try {
				await navigator.share(shareData);
				return;
			} catch {
				// User cancelled or share failed — fall through to clipboard
			}
		}

		try {
			await navigator.clipboard.writeText(pageUrl);
			shareState = 'copied';
			setTimeout(() => {
				shareState = 'idle';
			}, 2000);
		} catch {
			// Clipboard API unavailable — silently ignore
		}
	}

	let screenshotUrl = $derived(`/api/notices/${detail.notice.num}/screenshot`);
	let hasScreenshot = $derived(detail.screenshotMeta?.hasScreenshot ?? false);
	let screenshotCaptureError = $derived(detail.screenshotMeta?.captureError ?? null);

	let isChangeTimelineOpen = $state(false);

	function getPositiveIntQueryParam(raw: string | null): number | null {
		if (!raw) {
			return null;
		}

		if (!/^[1-9]\d*$/.test(raw)) return null;
		const parsed = Number(raw);
		if (!Number.isSafeInteger(parsed) || parsed <= 0) {
			return null;
		}

		return parsed;
	}

	$effect(() => {
		const timelineFromQuery = parseBooleanParam(currentUrl.searchParams.get('timeline'));
		if (['cmpFrom', 'cmpTo', 'cmpShowAll'].some((key) => currentUrl.searchParams.has(key))) {
			isChangeTimelineOpen = true;
		} else if (timelineFromQuery !== null) {
			isChangeTimelineOpen = timelineFromQuery;
		}

		const archiveFromQuery = parseBooleanParam(currentUrl.searchParams.get('archive'));
		if (archiveFromQuery !== null) {
			isArchiveMetaOpen = archiveFromQuery;
		}

		const screenshotFromQuery = parseBooleanParam(currentUrl.searchParams.get('screenshot'));
		if (screenshotFromQuery !== null && hasScreenshot) {
			isScreenshotExpanded = screenshotFromQuery;
		}
	});

	let snapshotsByRevision = $derived(buildRevisionSnapshots(changes.items));
	let selectedFromRev = $derived(getPositiveIntQueryParam(currentUrl.searchParams.get('cmpFrom')));
	let selectedToRev = $derived(getPositiveIntQueryParam(currentUrl.searchParams.get('cmpTo')));
	let showAllCompareFields = $derived(
		currentUrl.searchParams.get('cmpShowAll') === '1' ||
			currentUrl.searchParams.get('cmpShowAll') === 'true'
	);
	let comparisonPending = $state(false);
	let comparisonError = $state('');
	let selectionIssue = $derived.by(() => {
		for (const key of ['cmpFrom', 'cmpTo']) {
			const raw = currentUrl.searchParams.get(key);
			if (raw !== null) {
				const revision = getPositiveIntQueryParam(raw);
				if (revision === null || !snapshotsByRevision[revision]) {
					return revision !== null &&
						revision < (changes.items.at(-1)?.eventHeight ?? 0) &&
						historyHasMore
						? '선택한 기록은 아직 불러오지 않았습니다. 이전 기록을 더 불러오면 비교할 수 있습니다.'
						: '선택한 기록이 현재 목록에 없습니다. 아래 목록에서 비교할 기록을 다시 선택해주세요.';
				}
			}
		}
		return selectedFromRev !== null && selectedFromRev === selectedToRev
			? '서로 다른 두 기록을 선택해주세요.'
			: '';
	});
	let isCompareMode = $derived(
		!selectionIssue && selectedFromRev !== null && selectedToRev !== null
	);
	let revisionDiffItems = $derived(
		isCompareMode
			? compareRevisionSnapshots(
					snapshotsByRevision[selectedFromRev!],
					snapshotsByRevision[selectedToRev!]
				)
			: []
	);

	async function navigateComparison(params: SvelteURLSearchParams): Promise<void> {
		if (comparisonPending) return;
		comparisonPending = true;
		comparisonError = '';
		const focusedControl =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		try {
			const query = params.toString();
			await goto(query ? `${currentUrl.pathname}?${query}` : currentUrl.pathname, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		} catch {
			comparisonError = '비교할 기록을 선택하지 못했습니다. 잠시 후 다시 시도해주세요.';
		} finally {
			comparisonPending = false;
			await tick();
			if (document.activeElement === document.body && focusedControl?.isConnected) {
				focusedControl.focus({ preventScroll: true });
			}
		}
	}

	function buildRevisionLink(rev: number | null): string {
		const params = new SvelteURLSearchParams(currentUrl.searchParams);

		if (rev && rev > 0) {
			params.set('rev', String(rev));
		} else {
			params.delete('rev');
		}

		params.delete('cmpFrom');
		params.delete('cmpTo');
		params.delete('cmpShowAll');

		const query = params.toString();
		return query ? `${currentUrl.pathname}?${query}` : currentUrl.pathname;
	}

	async function toggleCompareShowAll(): Promise<void> {
		const next = !showAllCompareFields;
		const params = new SvelteURLSearchParams(currentUrl.searchParams);

		if (next) {
			params.set('cmpShowAll', '1');
		} else {
			params.delete('cmpShowAll');
		}

		await navigateComparison(params);
	}

	async function updateCompareQuery(fromRev: number | null, toRev: number | null): Promise<void> {
		const params = new SvelteURLSearchParams(currentUrl.searchParams);

		if (fromRev && fromRev > 0) {
			params.set('cmpFrom', String(fromRev));
		} else {
			params.delete('cmpFrom');
		}

		if (toRev && toRev > 0) {
			params.set('cmpTo', String(toRev));
		} else {
			params.delete('cmpTo');
		}

		params.delete('cmpShowAll');

		await navigateComparison(params);
	}
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	url={pageUrl}
	keywords={pageKeywords}
	type="article"
	image={`${currentUrl.origin}/notices/${detail.notice.num}/og.png`}
/>

<svelte:head>
	{#if publishedTime}
		<meta property="article:published_time" content={publishedTime} />
	{/if}
	{#if modifiedTime}
		<meta property="article:modified_time" content={modifiedTime} />
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${articleJsonLd}<` + `/script>`}
</svelte:head>

<div class="lc-page-shell">
	<Header />

	<main
		id="main-content"
		class="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
		aria-labelledby="notice-detail-title"
		data-testid="notice-detail-main"
	>
		<nav class="mb-8 flex items-center space-x-3 text-sm" aria-label="이동 경로">
			<a
				href={backLink}
				data-testid="notice-detail-back-link"
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2 transition-all duration-200"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				전체 입법예고
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<span class="lc-text-secondary font-semibold">법률안 원문 조회</span>
		</nav>

		{#if loadError}
			<RateLimitOverlay
				visible={Boolean(loadError)}
				retryAfter={countdown}
				onRetry={() => retry.retry()}
				{isRetrying}
			/>
		{/if}

		{#if aiSummaryEnabled}
			<section class="lc-banner-warning mb-6 rounded-xl border p-4 shadow-sm">
				<div class="flex items-start gap-3">
					<div class="lc-chip-warning mt-0.5 rounded-full p-1.5">
						<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
					</div>
					<div>
						<p class="text-sm font-semibold">안내</p>
						<p class="mt-1 text-sm leading-relaxed">
							AI 요약은 참고용이며 오류가 있을 수 있습니다. 아래 원문(제안이유 및 주요내용)을 최종
							기준으로 확인해주세요.
						</p>
					</div>
				</div>
			</section>
		{/if}

		{#if isHistoricalView && activeRevision !== null}
			<div
				class="lc-banner-warning mb-6 rounded-xl border px-4 py-3 text-sm"
				data-testid="historical-revision-banner"
			>
				기록 #{activeRevision}에 보존된 내용을 열람 중입니다. 현재 정보와 다를 수 있습니다.
				{#if headRevision !== null}
					<a href={buildRevisionLink(null)} class="ml-2 font-semibold lc-link">
						최신 기록 #{headRevision} 보기
					</a>
				{/if}
			</div>
		{/if}

		{#if displayContent.isDone}
			<div
				class="lc-banner-muted mb-6 flex items-start gap-3 rounded-xl border px-5 py-4 shadow-sm"
				role="status"
				aria-label="입법예고 종료 안내"
			>
				<div class="lc-chip-muted mt-0.5 rounded-full p-1.5">
					<FontAwesomeIcon icon={faLock} class="h-4 w-4" />
				</div>
				<div>
					<p class="lc-text-secondary text-sm font-semibold">입법예고 종료</p>
					<p class="lc-text-muted mt-0.5 text-sm">
						이 법률안의 입법예고 기간이 종료되었습니다. 내용은 참고용으로만 확인하시기 바랍니다.
					</p>
				</div>
			</div>
		{/if}

		{#if isSourceDeleted}
			<div
				class="lc-banner-warning mb-6 flex items-start gap-3 rounded-xl border px-5 py-4 shadow-sm"
				role="status"
				aria-label="소스 삭제 감지 안내"
			>
				<div class="lc-chip-warning mt-0.5 rounded-full p-1.5">
					<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
				</div>
				<div>
					<p class="text-sm font-semibold">보존 상태로 전환됨</p>
					<p class="mt-0.5 text-sm">
						원본 소스에서 현재 확인되지 않아 아카이브에 보존 처리됩니다.
						{#if displayContent.sourceDeletedAt}
							(감지 시각: {formatDateTime(displayContent.sourceDeletedAt)})
						{/if}
					</p>
				</div>
			</div>
		{:else if isRenumbered}
			<div
				class="lc-banner-muted mb-6 flex items-start gap-3 rounded-xl border px-5 py-4 shadow-sm"
				role="status"
				aria-label="의안번호 변경 안내"
			>
				<div class="lc-chip-muted mt-0.5 rounded-full p-1.5">
					<FontAwesomeIcon icon={faRotate} class="h-4 w-4" />
				</div>
				<div>
					<p class="lc-text-secondary text-sm font-semibold">의안번호 변경 이력</p>
					<p class="lc-text-muted mt-0.5 text-sm">
						기존 번호 기준 체인은 무효화(invalidated) 이벤트로 보존되며, 현재 번호에서 이력이
						이어집니다.
					</p>
				</div>
			</div>
		{/if}

		<section
			class={`mb-6 rounded-2xl border p-6 shadow-lg ${displayContent.isDone ? 'lc-panel-subtle' : 'lc-panel-card'}`}
			aria-labelledby="notice-detail-title"
			data-testid="notice-detail-summary"
		>
			<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
				<div>
					<div class="mb-2 flex flex-wrap items-center gap-2">
						<div
							class="lc-chip-blue inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
						>
							<FontAwesomeIcon icon={faScaleBalanced} class="mr-1.5 h-3.5 w-3.5" />
							의안번호 {detail.notice.num}
						</div>
						{#if displayContent.isDone}
							<div
								class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
							>
								<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
								종료됨
							</div>
						{:else}
							<div
								class="lc-chip-success inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
							>
								<span class="lc-dot-success h-1.5 w-1.5 rounded-full"></span>
								진행 중
							</div>
						{/if}
						{#if deadline.kind !== 'none'}
							<div
								class={`${deadline.kind === 'open' ? 'lc-chip-danger' : 'lc-chip-muted'} inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold`}
								data-testid="notice-detail-deadline-chip"
							>
								<FontAwesomeIcon icon={faClock} class="h-2.5 w-2.5" />
								{deadline.label}
							</div>
						{/if}
						{#if isSourceDeleted}
							<div
								class="lc-chip-warning inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
							>
								소스 미존재(보존)
							</div>
						{:else if isRenumbered}
							<div
								class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
							>
								번호 변경 이력
							</div>
						{/if}
					</div>
					<h1
						id="notice-detail-title"
						class={`text-2xl leading-snug font-bold ${displayContent.isDone ? 'lc-text-muted' : 'lc-text-primary'}`}
					>
						{displayContent.title}
					</h1>
					<div class="lc-text-secondary mt-3 flex flex-wrap gap-3 text-sm">
						<span class="lc-chip-muted inline-flex items-center rounded-md px-2 py-1">
							<FontAwesomeIcon icon={faUser} class="mr-1.5 h-3.5 w-3.5" />
							제안자 구분: {displayContent.proposerCategory}
						</span>
						{#if displayContent.committee}
							<span class="lc-chip-muted inline-flex items-center rounded-md px-2 py-1">
								<FontAwesomeIcon icon={faBell} class="mr-1.5 h-3.5 w-3.5" />
								{displayContent.committee}
							</span>
						{/if}
						<span class="lc-chip-success inline-flex items-center rounded-md px-2 py-1">
							<FontAwesomeIcon icon={faClock} class="mr-1.5 h-3.5 w-3.5" />
							아카이브: {formatDateTime(detail.archiveMetadata.archivedAt)}
						</span>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<a
						href="#notice-discussions"
						data-testid="notice-detail-discussions-anchor"
						class="lc-button-neutral inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors"
					>
						<FontAwesomeIcon icon={faComments} class="mr-2 h-4 w-4" />
						<span>토론</span>
						{#if data.discussions?.total && data.discussions.total > 0}
							<span
								class="lc-chip-blue ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-bold"
							>
								{data.discussions.total}
							</span>
						{/if}
					</a>
					<button
						onclick={shareNotice}
						data-testid="notice-detail-share"
						class="lc-button-neutral inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors"
					>
						<FontAwesomeIcon
							icon={shareState === 'copied' ? faCheck : faShareNodes}
							class="mr-2 h-4 w-4"
						/>
						{shareState === 'copied' ? '링크 복사됨' : '공유'}
					</button>
					<!-- Utility link-out: kept neutral so the opinion CTA below owns the
					     page's single primary emphasis (both open the same URL). -->
					<button
						onclick={() => openExternalLink(detail.notice.link)}
						data-testid="notice-detail-open-source"
						class="lc-button-neutral inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors"
					>
						<FontAwesomeIcon icon={faExternalLink} class="mr-2 h-4 w-4" />
						국회 페이지 열기
					</button>
				</div>
			</div>

			{#if shouldShowAIBriefing}
				<AIBriefingCard
					summary={detail.notice.aiSummary ?? null}
					status={detail.notice.aiSummaryStatus ?? 'unavailable'}
				/>
			{/if}
		</section>

		<!-- Opinion submission entry CTA: the notice period is the opinion window.
		     Rendered as its own panel below the header card so the primary action
		     stays visually separated from the title metadata. The CTA links the
		     PAL opinion page built from the contentId, never the archived
		     source link, which may still point at the pre-transfer system. -->
		<section class="mb-6" aria-label="의견 제출">
			<div
				class="lc-panel-inset flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
				data-testid="notice-opinion-cta"
			>
				{#if displayContent.isDone}
					<button
						type="button"
						disabled
						data-testid="notice-opinion-submit"
						class="lc-button-neutral inline-flex cursor-not-allowed items-center rounded-lg border px-4 py-2 text-sm font-semibold opacity-70"
					>
						<FontAwesomeIcon icon={faLock} class="mr-2 h-4 w-4" />
						제출 기간 종료
					</button>
				{:else if isPreTransfer}
					<button
						type="button"
						disabled
						data-testid="notice-opinion-submit"
						class="lc-button-neutral inline-flex cursor-not-allowed items-center rounded-lg border px-4 py-2 text-sm font-semibold opacity-70"
					>
						<FontAwesomeIcon icon={faLock} class="mr-2 h-4 w-4" />
						의견 제출 불가
					</button>
				{:else}
					<button
						type="button"
						onclick={() =>
							openExternalLink(buildOpinionSubmissionUrlForContentId(opinionContentId))}
						data-testid="notice-opinion-submit"
						class="lc-button-primary inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap"
					>
						<FontAwesomeIcon icon={faPaperPlane} class="mr-2 h-4 w-4" />
						의견 제출하기
					</button>
				{/if}
				<p class="lc-text-secondary text-sm" data-testid="notice-opinion-guidance">
					{opinionGuidanceText}
				</p>
			</div>
		</section>

		{#if contentFacts.length > 0}
			<section
				class="lc-panel-card lc-defer-render-sm mb-6 rounded-2xl border p-6 shadow-sm"
				aria-labelledby="notice-detail-facts-heading"
				data-testid="notice-detail-facts"
			>
				<div class="mb-4 flex items-center gap-2">
					<FontAwesomeIcon icon={faScaleBalanced} class="lc-text-accent h-5 w-5" />
					<h2 id="notice-detail-facts-heading" class="lc-text-primary text-lg font-bold">
						입법예고 정보
					</h2>
				</div>
				<dl class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each contentFacts as fact (fact.label)}
						<div
							class="lc-panel-inset rounded-lg border px-3 py-2"
							data-testid={`notice-fact-${fact.label}`}
						>
							<dt class="lc-text-muted text-xs font-semibold">{fact.label}</dt>
							<dd class="lc-text-primary mt-1 text-sm font-medium">{fact.value}</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}

		<section
			class="lc-panel-card mb-6 rounded-2xl border p-6 shadow-sm"
			aria-labelledby="notice-detail-content-heading"
			data-testid="notice-detail-content"
		>
			<div class="mb-4 flex items-center gap-2">
				<FontAwesomeIcon icon={faFileLines} class="lc-text-purple h-5 w-5" />
				<h2 id="notice-detail-content-heading" class="lc-text-primary text-lg font-bold">
					제안이유 및 주요내용 원문
				</h2>
			</div>

			{#if displayContent.proposalReason}
				<p
					class="lc-text-primary text-sm leading-7 whitespace-pre-line"
					data-testid="notice-detail-proposal-reason"
				>
					{displayContent.proposalReason}
				</p>
			{:else}
				<div class="lc-banner-warning flex items-start gap-3 rounded-lg border p-4">
					<FontAwesomeIcon
						icon={faTriangleExclamation}
						class="lc-text-warning mt-0.5 h-4 w-4 shrink-0"
					/>
					<p class="text-sm">
						원문 데이터를 웹사이트에서 확인하지 못했습니다. 국회 페이지에서 직접 확인하시기
						바랍니다.
					</p>
				</div>
			{/if}
		</section>

		<NoticeDiscussions
			noticeNum={detail.notice.num}
			initialDiscussions={data.discussions}
			initialDiscussionError={data.discussionError}
		/>

		<section
			id="change-tracking-timeline"
			bind:this={timelineSectionElement}
			aria-labelledby="notice-detail-timeline-heading"
			data-testid="notice-detail-timeline"
			class="lc-defer-render scroll-mt-40"
		>
			<h2 id="notice-detail-timeline-heading" class="sr-only">변경 기록</h2>
			{#if hasLegacyGenesisBoundary}
				<div class="lc-banner-muted mb-4 rounded-xl border px-4 py-3 text-sm">
					변경 추적 이력은
					<strong>
						{legacyGenesisBoundaryAt ? formatDateTime(legacyGenesisBoundaryAt) : '도입 기준 시점'}
					</strong>
					이후부터 보장됩니다. 그 이전 변경 이력은 복원 대상에서 제외됩니다.
				</div>
			{/if}

			<NoticeChangeTimeline
				bind:isOpen={isChangeTimelineOpen}
				{changes}
				hasMore={revisionHistoryCursor(changes).hasMore}
				loadingMore={historyLoading}
				loadMoreError={historyPageError}
				onLoadMore={loadOlderHistory}
				historyError={data.changesLoadError}
				onRetryHistory={invalidateAll}
				{activeRevisionForUi}
				{buildRevisionLink}
				{isCompareMode}
				{selectedFromRev}
				{selectedToRev}
				{showAllCompareFields}
				{comparisonPending}
				comparisonError={comparisonError || selectionIssue}
				onToggleCompareShowAll={toggleCompareShowAll}
				{revisionDiffItems}
				onSelectCompare={updateCompareQuery}
			/>
		</section>

		<details
			bind:open={isArchiveMetaOpen}
			class="lc-panel-card lc-defer-render group rounded-2xl border p-6 shadow-sm"
			data-testid="notice-detail-archive-meta"
		>
			<summary
				class="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition-colors duration-200 hover:bg-[var(--lc-surface-hover)]"
			>
				<span class="flex items-center gap-2">
					<FontAwesomeIcon icon={faShieldHalved} class="lc-text-success h-5 w-5" />
					<h2 id="notice-detail-archive-heading" class="lc-text-primary text-lg font-bold">
						아카이브 상세정보
					</h2>
				</span>
				<span
					class="lc-button-neutral inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200"
				>
					<span
						class="inline-flex transition-transform duration-200"
						class:rotate-180={isArchiveMetaOpen}
					>
						<FontAwesomeIcon icon={faChevronDown} class="h-4 w-4" />
					</span>
				</span>
			</summary>

			{#if isArchiveMetaOpen}
				<div in:slide={{ duration: 240 }} out:slide={{ duration: 180 }}>
					<div in:fade={{ duration: 200 }} out:fade={{ duration: 140 }} class="mt-4">
						<div class="mb-3 flex flex-wrap justify-end gap-2">
							{#if hasScreenshot}
								<button
									onclick={() => (isScreenshotExpanded = !isScreenshotExpanded)}
									data-testid="notice-detail-screenshot-toggle"
									class="lc-button-neutral inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
									aria-expanded={isScreenshotExpanded}
								>
									<FontAwesomeIcon icon={faImage} class="mr-1.5 h-3.5 w-3.5" />
									{isScreenshotExpanded ? '미리보기 닫기' : '국회 페이지 미리보기'}
								</button>
							{/if}
							<button
								type="button"
								onclick={downloadArchiveZip}
								disabled={isExportingArchive}
								data-testid="notice-detail-download-archive"
								class="lc-button-neutral inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
							>
								<FontAwesomeIcon icon={faDownload} class="mr-1.5 h-3.5 w-3.5" />
								{isExportingArchive ? 'ZIP 준비 중...' : '자료 반출 요청(ZIP)'}
							</button>
						</div>
						{#if exportArchiveError}
							<p class="lc-text-danger mb-3 text-right text-xs">{exportArchiveError}</p>
						{/if}

						{#if !hasScreenshot && screenshotCaptureError}
							<div
								class="mb-3 flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs dark:border-amber-500/30 dark:bg-amber-900/20"
								data-testid="notice-detail-screenshot-capture-error"
							>
								<FontAwesomeIcon
									icon={faTriangleExclamation}
									class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
								/>
								<span class="lc-text-secondary">
									{screenshotCaptureError}
								</span>
							</div>
						{:else if !hasScreenshot}
							<div
								class="mb-3 flex items-start gap-2 rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-secondary)] px-3 py-2 text-xs"
								data-testid="notice-detail-screenshot-pending"
							>
								<FontAwesomeIcon icon={faImage} class="mt-0.5 h-3.5 w-3.5 shrink-0 lc-text-muted" />
								<span class="lc-text-secondary"> 스크린샷이 아직 캡처되지 않았습니다 </span>
							</div>
						{/if}

						{#if hasScreenshot && isScreenshotExpanded}
							<div
								class="lc-panel-inset mb-4 overflow-hidden rounded-xl border"
								in:slide={{ duration: 220 }}
								out:slide={{ duration: 160 }}
							>
								<div
									class="flex items-center justify-between border-b border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-4 py-2.5"
								>
									<span class="lc-text-secondary flex items-center gap-2 text-xs font-semibold">
										<FontAwesomeIcon icon={faImage} class="h-3.5 w-3.5" />
										국회 입법예고 페이지 스크린샷
									</span>
									<a
										href={screenshotUrl}
										download={`notice-${detail.notice.num}-screenshot.${detail.screenshotMeta.format ?? 'jpeg'}`}
										data-testid="notice-detail-screenshot-download"
										class="lc-button-primary inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors"
									>
										<FontAwesomeIcon icon={faDownload} class="h-3 w-3" />
										다운로드
									</a>
								</div>
								{#key screenshotUrl}
									<NoticeScreenshot src={screenshotUrl} noticeNum={detail.notice.num} />
								{/key}
							</div>
						{/if}
						<dl class="grid gap-3 text-sm sm:grid-cols-2">
							<div class="lc-stat-tile rounded-lg border px-3 py-2">
								<dt class="lc-text-muted text-xs font-semibold">아카이브 시각</dt>
								<dd class="lc-text-primary mt-1 font-medium">
									<FontAwesomeIcon icon={faClock} class="lc-text-muted mr-1 h-3.5 w-3.5" />
									{formatDateTime(detail.archiveMetadata.archivedAt)}
								</dd>
							</div>
							<div class="lc-stat-tile rounded-lg border px-3 py-2">
								<dt class="lc-text-muted text-xs font-semibold">무결성 검증</dt>
								<dd class="lc-text-primary mt-1 font-medium">{integrityStatusLabel}</dd>
								<p class="lc-text-secondary mt-1 text-xs">
									검증 시각: {formatDateTime(detail.archiveMetadata.integrity.checkedAt)}
								</p>
								{#if detail.archiveMetadata.integrity.skipReason}
									<p class="lc-text-secondary mt-1 text-xs">
										스킵 사유: {detail.archiveMetadata.integrity.skipReason}
									</p>
								{/if}
							</div>
							<div class="lc-stat-tile rounded-lg border px-3 py-2 sm:col-span-2">
								<dt class="lc-text-muted text-xs font-semibold">SHA256 지문</dt>
								<dd class="lc-text-primary mt-1 font-mono text-xs break-all">
									<FontAwesomeIcon icon={faFingerprint} class="lc-text-muted h-3.5 w-3.5" />
									{detail.archiveMetadata.sourceHtmlSha256 || 'N/A'}
								</dd>
								<p class="lc-text-secondary mt-1 text-xs">
									원문 HTML 크기: {detail.archiveMetadata.sourceHtmlSize.toLocaleString('ko-KR')} bytes
								</p>
							</div>
							<div class="lc-stat-tile rounded-lg border px-3 py-2">
								<dt class="lc-text-muted text-xs font-semibold">HTTP 상태 코드</dt>
								<dd class="lc-text-primary mt-1 font-medium">
									{detail.archiveMetadata.http.statusCode ?? 'N/A'}
								</dd>
							</div>
							<div class="lc-stat-tile rounded-lg border px-3 py-2">
								<dt class="lc-text-muted text-xs font-semibold">HTTP 수집 시각</dt>
								<dd class="lc-text-primary mt-1 font-medium">
									{formatDateTime(detail.archiveMetadata.http.fetchedAt)}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			{/if}
		</details>
	</main>
</div>
