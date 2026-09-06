<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import { openExternalLink } from '$lib/utils/helpers';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
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
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import NoticeDiscussions from '$lib/components/discussions/NoticeDiscussions.svelte';

	export let data: {
		detail: NoticeDetail;
		changes: NoticeChangeTimelineResponse;
		discussions?: DiscussionThreadListResponse;
		discussionError?: {
			status: number;
			message: string;
			retryAfter?: number;
		};
	};

	$: detail = data.detail;
	$: changes = data.changes;
	$: aiSummaryEnabled = detail.aiSummaryEnabled !== false;

	let currentUrl = page.url;
	afterNavigate(() => {
		currentUrl = page.url;
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

	$: pageTitle = `${displayContent.title} - 제안이유 및 주요내용 원문 | LawCast`;
	$: pageDescription = buildExcerpt(
		aiSummaryEnabled
			? (detail.notice.aiSummary ?? displayContent.proposalReason)
			: displayContent.proposalReason
	);

	function safeJsonLd(data: object): string {
		return JSON.stringify(data)
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e')
			.replace(/&/g, '\\u0026');
	}

	$: pageUrl = currentUrl.origin + currentUrl.pathname;
	$: publishedTime = detail.archiveMetadata.archivedAt ?? detail.notice.archiveStartedAt ?? null;
	$: modifiedTime = detail.notice.lastUpdatedAt ?? publishedTime;
	$: pageKeywords = [
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
		.join(', ');
	$: articleJsonLd = safeJsonLd({
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
	});

	$: shouldShowAIBriefing =
		aiSummaryEnabled &&
		(detail.notice.aiSummaryStatus === 'ready' || detail.notice.aiSummaryStatus === 'unavailable');
	$: integrityStatus =
		detail.archiveMetadata.integrity.status ??
		(detail.archiveMetadata.integrity.passed === true
			? 'passed'
			: detail.archiveMetadata.integrity.passed === false
				? 'failed'
				: 'pending');
	$: integrityStatusLabel =
		integrityStatus === 'passed'
			? '검증 통과'
			: integrityStatus === 'failed'
				? '검증 실패'
				: integrityStatus === 'skipped'
					? '검증 스킵'
					: '검증 대기';
	$: lifecycleStatus = displayContent.lifecycleStatus ?? 'active';
	$: isSourceDeleted = lifecycleStatus === 'source_deleted';
	$: isRenumbered = lifecycleStatus === 'renumbered';

	$: contentFacts = [
		{ label: '의안번호', value: displayContent.billNumber },
		// Remove unnecessary prefix from proposer field if present
		{ label: '제안자', value: displayContent.proposer?.replace('제안자목록', '').trim() },
		{ label: '제안일', value: displayContent.proposalDate },
		{ label: '소관위원회', value: displayContent.committee },
		{ label: '회부일', value: displayContent.referralDate },
		{ label: '입법예고기간', value: displayContent.noticePeriod },
		{ label: '제안회기', value: displayContent.proposalSession }
	].filter((item) => !!item.value);

	$: pageParam = currentUrl.searchParams.get('page');
	$: limitParam = currentUrl.searchParams.get('limit');
	$: searchParam = currentUrl.searchParams.get('search');
	$: startDateParam = currentUrl.searchParams.get('startDate');
	$: endDateParam = currentUrl.searchParams.get('endDate');
	$: sortOrderParam = currentUrl.searchParams.get('sortOrder');
	$: currentRevision = detail.revision;
	$: headRevision = currentRevision?.headRev ?? null;
	$: activeRevision = currentRevision?.resolvedRev ?? null;
	$: isHistoricalView = currentRevision?.isHistorical ?? false;
	$: activeRevisionForUi = activeRevision ?? headRevision;
	$: hasLegacyGenesisBoundary = currentRevision?.hasLegacyGenesisBoundary ?? false;
	$: legacyGenesisBoundaryAt = currentRevision?.legacyGenesisBoundaryAt ?? null;

	$: backLink = (() => {
		const params = new SvelteURLSearchParams();
		if (pageParam) params.set('page', pageParam);
		if (limitParam) params.set('limit', limitParam);
		if (searchParam) params.set('search', searchParam);
		if (startDateParam) params.set('startDate', startDateParam);
		if (endDateParam) params.set('endDate', endDateParam);
		if (sortOrderParam) params.set('sortOrder', sortOrderParam);
		const query = params.toString();
		return query ? `/notices?${query}` : '/notices';
	})();

	let isArchiveMetaOpen = false;
	let isScreenshotExpanded = false;
	let isExportingArchive = false;
	let shareState: 'idle' | 'copied' = 'idle';
	let exportArchiveError: string | null = null;
	let timelineSectionElement: HTMLElement | null = null;
	let hasAutoScrolledToTimeline = false;

	async function autoScrollToTimelineOnLoad(): Promise<void> {
		if (hasAutoScrolledToTimeline || !currentUrl.searchParams.has('timeline')) {
			return;
		}

		await tick();
		if (!timelineSectionElement) {
			return;
		}

		timelineSectionElement.scrollIntoView({
			behavior: 'smooth',
			block: 'start'
		});
		hasAutoScrolledToTimeline = true;
	}

	onMount(() => {
		void autoScrollToTimelineOnLoad();
	});

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
		const shareData = {
			title: pageTitle,
			text: `${displayContent.title} | LawCast`,
			url: pageUrl
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

	$: screenshotUrl = `/api/notices/${detail.notice.num}/screenshot`;
	$: hasScreenshot = detail.screenshotMeta?.hasScreenshot ?? false;

	let isChangeTimelineOpen = false;

	function getPositiveIntQueryParam(raw: string | null): number | null {
		if (!raw) {
			return null;
		}

		const parsed = Number.parseInt(raw, 10);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			return null;
		}

		return parsed;
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

	$: {
		const timelineFromQuery = parseBooleanParam(currentUrl.searchParams.get('timeline'));
		if (timelineFromQuery !== null) {
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
	}

	const CHANGE_FIELD_LABELS: Record<string, string> = {
		num: '의안번호',
		contentId: '국회 의안 ID',
		subject: '법률안명',
		proposerCategory: '제안자 구분',
		committee: '소관위원회',
		proposalReason: '제안이유',
		billNumber: '입법예고 의안번호',
		contentBillNumber: '입법예고 의안번호',
		proposer: '입법예고 제안자',
		contentProposer: '입법예고 제안자',
		proposalDate: '입법예고 제안일',
		contentProposalDate: '입법예고 제안일',
		contentCommittee: '입법예고 소관위원회',
		referralDate: '입법예고 회부일',
		contentReferralDate: '입법예고 회부일',
		noticePeriod: '입법예고 기간',
		contentNoticePeriod: '입법예고 기간',
		proposalSession: '입법예고 제안회기',
		contentProposalSession: '입법예고 제안회기',
		isDone: '처리 상태',
		lifecycleStatus: '보존 상태',
		sourceDeletedAt: '소스 삭제 감지 시각'
	};

	function toReadableFieldLabel(fieldPath: string): string {
		return CHANGE_FIELD_LABELS[fieldPath] ?? fieldPath;
	}

	type RevisionSnapshot = Record<string, string | null>;
	type RevisionDiffItem = {
		fieldPath: string;
		fieldLabel: string;
		changeType: 'added' | 'removed' | 'modified' | 'unchanged';
		beforeValue: string | null;
		afterValue: string | null;
	};

	function buildSnapshotsByRevision(
		events: NoticeChangeTimelineResponse['items']
	): Record<number, RevisionSnapshot> {
		const snapshots: Record<number, RevisionSnapshot> = {};
		const current: RevisionSnapshot = {};
		const asc = [...events].sort((a, b) => a.eventHeight - b.eventHeight);

		for (const event of asc) {
			for (const detail of event.details) {
				current[detail.fieldPath] = detail.afterValue;
			}
			snapshots[event.eventHeight] = { ...current };
		}

		return snapshots;
	}

	$: snapshotsByRevision = buildSnapshotsByRevision(changes.items);
	$: displayContent = buildDisplayContentFromDetail(detail);
	$: selectedFromRev = getPositiveIntQueryParam(currentUrl.searchParams.get('cmpFrom'));
	$: selectedToRev = getPositiveIntQueryParam(currentUrl.searchParams.get('cmpTo'));
	$: showAllCompareFields =
		currentUrl.searchParams.get('cmpShowAll') === '1' ||
		currentUrl.searchParams.get('cmpShowAll') === 'true';
	$: fromSnapshot = selectedFromRev === null ? {} : (snapshotsByRevision[selectedFromRev] ?? {});
	$: toSnapshot = selectedToRev === null ? {} : (snapshotsByRevision[selectedToRev] ?? {});
	$: comparableRevisionCount = Object.keys(snapshotsByRevision).length;
	$: canSelectCompareBase = comparableRevisionCount > 1;
	$: revisionDiffItems = (() => {
		const keys = new Set<string>([
			...Object.keys(CHANGE_FIELD_LABELS),
			...Object.keys(fromSnapshot),
			...Object.keys(toSnapshot)
		]);
		const items: RevisionDiffItem[] = [];

		for (const key of keys) {
			const beforeValue = fromSnapshot[key] ?? null;
			const afterValue = toSnapshot[key] ?? null;
			if (!showAllCompareFields && beforeValue === afterValue) {
				continue;
			}

			const changeType: RevisionDiffItem['changeType'] =
				beforeValue === afterValue
					? 'unchanged'
					: beforeValue === null
						? 'added'
						: afterValue === null
							? 'removed'
							: 'modified';

			items.push({
				fieldPath: key,
				fieldLabel: toReadableFieldLabel(key),
				changeType,
				beforeValue,
				afterValue
			});
		}

		return items.sort((a, b) => a.fieldLabel.localeCompare(b.fieldLabel, 'ko-KR'));
	})();
	$: isCompareMode =
		selectedFromRev !== null && selectedToRev !== null && selectedFromRev !== selectedToRev;

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

	function buildCompareEntryLink(fromRev: number | null, toRev: number | null): string {
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

		const query = params.toString();
		await goto(query ? `${currentUrl.pathname}?${query}` : currentUrl.pathname, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
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

		const query = params.toString();
		await goto(query ? `${currentUrl.pathname}?${query}` : currentUrl.pathname, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<link rel="canonical" href={pageUrl} />
	<meta name="description" content={pageDescription} />
	<meta name="keywords" content={pageKeywords} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	{#if publishedTime}
		<meta property="article:published_time" content={publishedTime} />
	{/if}
	{#if modifiedTime}
		<meta property="article:modified_time" content={modifiedTime} />
	{/if}
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${articleJsonLd}<` + `/script>`}
</svelte:head>

<div class="page-shell">
	<Header />

	<main
		id="main-content"
		class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
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

		{#if isHistoricalView && activeRevision !== null}
			<div class="lc-banner-warning mb-6 rounded-xl border px-4 py-3 text-sm">
				현재 Rev #{activeRevision} 시점 원문을 열람 중입니다.
				{#if headRevision !== null}
					<a href={buildRevisionLink(null)} class="ml-2 font-semibold underline">
						최신 리비전 #{headRevision} 보기
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
				<div class="flex items-center gap-2">
					<a
						href="#notice-discussions"
						data-testid="notice-detail-discussions-anchor"
						class="lc-button-neutral inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
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
						on:click={shareNotice}
						data-testid="notice-detail-share"
						class="lc-button-neutral inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
					>
						<FontAwesomeIcon
							icon={shareState === 'copied' ? faCheck : faShareNodes}
							class="mr-2 h-4 w-4"
						/>
						{shareState === 'copied' ? '링크 복사됨' : '공유'}
					</button>
					<button
						on:click={() => openExternalLink(detail.notice.link)}
						data-testid="notice-detail-open-source"
						class="lc-button-primary inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-semibold"
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
			class="lc-defer-render"
		>
			<h2 id="notice-detail-timeline-heading" class="sr-only">변경 추적 타임라인</h2>
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
				{activeRevisionForUi}
				{buildRevisionLink}
				{isCompareMode}
				{selectedFromRev}
				{selectedToRev}
				{showAllCompareFields}
				clearCompareHref={buildCompareEntryLink(null, null)}
				onToggleCompareShowAll={toggleCompareShowAll}
				{revisionDiffItems}
				{canSelectCompareBase}
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
									on:click={() => (isScreenshotExpanded = !isScreenshotExpanded)}
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
								on:click={downloadArchiveZip}
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
								<div class="p-3">
									<img
										src={screenshotUrl}
										alt="의안번호 {detail.notice.num} 국회 입법예고 페이지 스크린샷"
										data-testid="notice-detail-screenshot-image"
										class="w-full rounded-lg border border-[var(--lc-border-soft)] shadow-sm"
										loading="lazy"
									/>
								</div>
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
