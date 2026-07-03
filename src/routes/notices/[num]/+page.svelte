<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import AIBriefingCard from '$lib/components/AIBriefingCard.svelte';
	import { openExternalLink } from '$lib/utils/helpers';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBell,
		faChevronDown,
		faClock,
		faCodeCompare,
		faDownload,
		faFingerprint,
		faExternalLink,
		faListCheck,
		faFileLines,
		faRotate,
		faImage,
		faLock,
		faScaleBalanced,
		faShieldHalved,
		faTriangleExclamation,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import type { NoticeDetail, NoticeChangeTimelineResponse } from '$lib/types/api';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	export let data: {
		detail: NoticeDetail;
		changes: NoticeChangeTimelineResponse;
	};

	$: detail = data.detail;
	$: changes = data.changes;
	$: aiSummaryEnabled = detail.aiSummaryEnabled !== false;

	function buildExcerpt(content: string, maxLength = 180): string {
		const normalized = content.replace(/\s+/g, ' ').trim();

		if (normalized.length <= maxLength) {
			return normalized;
		}

		return `${normalized.slice(0, maxLength)}...`;
	}

	function formatDateTime(value: string | null): string {
		if (!value) {
			return 'N/A';
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return 'N/A';
		}

		return date.toLocaleString('ko-KR');
	}

	$: pageTitle = `${detail.notice.subject} - 제안이유 및 주요내용 원문 | LawCast`;
	$: pageDescription = buildExcerpt(
		aiSummaryEnabled
			? (detail.notice.aiSummary ?? detail.originalContent.proposalReason)
			: detail.originalContent.proposalReason
	);

	function safeJsonLd(data: object): string {
		return JSON.stringify(data)
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e')
			.replace(/&/g, '\\u0026');
	}

	$: pageUrl = $page.url.origin + $page.url.pathname;
	$: publishedTime = detail.archiveMetadata.archivedAt ?? detail.notice.archiveStartedAt ?? null;
	$: modifiedTime = detail.notice.lastUpdatedAt ?? publishedTime;
	$: pageKeywords = [
		detail.notice.subject,
		detail.originalContent.committee ?? detail.notice.committee,
		detail.originalContent.proposer,
		detail.originalContent.billNumber,
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
					{ '@type': 'ListItem', position: 1, name: '홈', item: `${$page.url.origin}/` },
					{
						'@type': 'ListItem',
						position: 2,
						name: '전체 입법예고',
						item: `${$page.url.origin}/notices`
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
				headline: detail.notice.subject,
				description: pageDescription,
				url: pageUrl,
				...(publishedTime ? { datePublished: publishedTime } : {}),
				...(modifiedTime ? { dateModified: modifiedTime } : {}),
				author: detail.originalContent.proposer
					? { '@type': 'Organization', name: detail.originalContent.proposer }
					: undefined,
				publisher: { '@type': 'Organization', name: 'LawCast' },
				inLanguage: 'ko',
				isPartOf: { '@type': 'WebSite', name: 'LawCast', url: `${$page.url.origin}/` }
			}
		]
	});

	$: shouldShowAIBriefing =
		aiSummaryEnabled &&
		(detail.notice.aiSummaryStatus === 'ready' || detail.notice.aiSummaryStatus === 'unavailable');
	$: integrityStatusLabel =
		detail.archiveMetadata.integrity.passed === true
			? '검증 통과'
			: detail.archiveMetadata.integrity.passed === false
				? '검증 실패'
				: '검증 대기';

	$: contentFacts = [
		{ label: '의안번호', value: detail.originalContent.billNumber },
		{ label: '제안자', value: detail.originalContent.proposer },
		{ label: '제안일', value: detail.originalContent.proposalDate },
		{ label: '소관위원회', value: detail.originalContent.committee },
		{ label: '회부일', value: detail.originalContent.referralDate },
		{ label: '입법예고기간', value: detail.originalContent.noticePeriod },
		{ label: '제안회기', value: detail.originalContent.proposalSession }
	].filter((item) => !!item.value);

	$: pageParam = $page.url.searchParams.get('page');
	$: limitParam = $page.url.searchParams.get('limit');
	$: searchParam = $page.url.searchParams.get('search');
	$: startDateParam = $page.url.searchParams.get('startDate');
	$: endDateParam = $page.url.searchParams.get('endDate');
	$: sortOrderParam = $page.url.searchParams.get('sortOrder');

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
	let exportArchiveError: string | null = null;

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

	$: screenshotUrl = `/api/notices/${detail.notice.num}/screenshot`;
	$: hasScreenshot = detail.screenshotMeta?.hasScreenshot ?? false;

	let isChangeTimelineOpen = false;
	let changeTimelineSection: HTMLDetailsElement | null = null;
	let hasAutoScrolledToTimeline = false;
	$: shouldAutoScrollToTimeline =
		parseBooleanParam($page.url.searchParams.get('timeline')) === true;

	$: {
		const timelineFromQuery = parseBooleanParam($page.url.searchParams.get('timeline'));
		if (timelineFromQuery !== null) {
			isChangeTimelineOpen = timelineFromQuery;
		}

		const archiveFromQuery = parseBooleanParam($page.url.searchParams.get('archive'));
		if (archiveFromQuery !== null) {
			isArchiveMetaOpen = archiveFromQuery;
		}

		const screenshotFromQuery = parseBooleanParam($page.url.searchParams.get('screenshot'));
		if (screenshotFromQuery !== null && hasScreenshot) {
			isScreenshotExpanded = screenshotFromQuery;
		}
	}

	async function scrollToTimelineOnLoad(): Promise<void> {
		if (!shouldAutoScrollToTimeline || hasAutoScrolledToTimeline) {
			return;
		}

		await tick();
		if (!changeTimelineSection) {
			return;
		}

		changeTimelineSection.scrollIntoView({
			block: 'start',
			behavior: 'auto'
		});
		hasAutoScrolledToTimeline = true;
	}

	onMount(() => {
		void scrollToTimelineOnLoad();
	});

	function handleTimelineToggle(): void {
		if (isChangeTimelineOpen) {
			void scrollToTimelineOnLoad();
		}
	}

	function changeTypeLabel(changeType: string): string {
		switch (changeType) {
			case 'added':
				return '추가됨';
			case 'removed':
				return '삭제됨';
			case 'modified':
				return '수정됨';
			default:
				return changeType;
		}
	}

	function eventTypeLabel(eventType: string): string {
		switch (eventType) {
			case 'created':
				return '문서 생성';
			case 'updated':
				return '문서 갱신';
			case 'redacted':
				return '내용 가림';
			case 'invalidated':
				return '문서 무효화';
			default:
				return eventType;
		}
	}

	const CHANGE_FIELD_LABELS: Record<string, string> = {
		num: '의안번호',
		subject: '법률안명',
		proposerCategory: '제안자 구분',
		committee: '소관위원회',
		proposalReason: '제안이유',
		billNumber: '입법예고 의안번호',
		proposer: '입법예고 제안자',
		proposalDate: '입법예고 제안일',
		contentCommittee: '입법예고 소관위원회',
		referralDate: '입법예고 회부일',
		noticePeriod: '입법예고 기간',
		proposalSession: '입법예고 제안회기',
		isDone: '처리 상태'
	};

	function toReadableSourceLabel(source: string | null): string {
		if (!source) {
			return '시스템';
		}

		if (source.includes('archive:upsert')) return '아카이브 저장';
		if (source.includes('archive:updateSourceHtml')) return '원문 HTML 갱신';
		if (source.includes('archive:updateNsmHtmlAndDetail')) return '국회 원문/상세 동기화';
		if (source.includes('nsm')) return '국회 연계 동기화';

		return source;
	}

	function toReadableFieldLabel(fieldPath: string): string {
		return CHANGE_FIELD_LABELS[fieldPath] ?? fieldPath;
	}

	type DiffSegment = {
		text: string;
		kind: 'context' | 'removed' | 'added';
	};

	function buildInlineDiffSegments(
		beforeValue: string | null,
		afterValue: string | null
	): { beforeSegments: DiffSegment[]; afterSegments: DiffSegment[] } {
		const before = beforeValue ?? '';
		const after = afterValue ?? '';

		if (before === after) {
			return {
				beforeSegments: before ? [{ text: before, kind: 'context' }] : [],
				afterSegments: after ? [{ text: after, kind: 'context' }] : []
			};
		}

		let prefixLength = 0;
		const maxPrefixLength = Math.min(before.length, after.length);
		while (prefixLength < maxPrefixLength && before[prefixLength] === after[prefixLength]) {
			prefixLength += 1;
		}

		let suffixLength = 0;
		const maxSuffixLength = Math.min(before.length - prefixLength, after.length - prefixLength);
		while (
			suffixLength < maxSuffixLength &&
			before[before.length - 1 - suffixLength] === after[after.length - 1 - suffixLength]
		) {
			suffixLength += 1;
		}

		const beforePrefix = before.slice(0, prefixLength);
		const beforeChanged = before.slice(prefixLength, before.length - suffixLength);
		const beforeSuffix = before.slice(before.length - suffixLength);

		const afterPrefix = after.slice(0, prefixLength);
		const afterChanged = after.slice(prefixLength, after.length - suffixLength);
		const afterSuffix = after.slice(after.length - suffixLength);

		return {
			beforeSegments: [
				...(beforePrefix ? [{ text: beforePrefix, kind: 'context' as const }] : []),
				...(beforeChanged ? [{ text: beforeChanged, kind: 'removed' as const }] : []),
				...(beforeSuffix ? [{ text: beforeSuffix, kind: 'context' as const }] : [])
			],
			afterSegments: [
				...(afterPrefix ? [{ text: afterPrefix, kind: 'context' as const }] : []),
				...(afterChanged ? [{ text: afterChanged, kind: 'added' as const }] : []),
				...(afterSuffix ? [{ text: afterSuffix, kind: 'context' as const }] : [])
			]
		};
	}

	function shortenHash(hash: string): string {
		if (!hash) {
			return 'N/A';
		}

		if (hash.length <= 20) {
			return hash;
		}

		return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
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

	<main id="main-content" class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
		<nav class="mb-8 flex items-center space-x-3 text-sm" aria-label="이동 경로">
			<a
				href={backLink}
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-2 transition-all duration-200"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-2 h-4 w-4" />
				전체 입법예고
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<span class="lc-text-secondary font-semibold">법률안 원문 조회</span>
		</nav>

		{#if detail.notice.isDone}
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

		<section
			class={`mb-6 rounded-2xl border p-6 shadow-lg ${detail.notice.isDone ? 'lc-panel-subtle' : 'lc-panel-card'}`}
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
						{#if detail.notice.isDone}
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
					</div>
					<h1
						class={`text-2xl leading-snug font-bold ${detail.notice.isDone ? 'lc-text-muted' : 'lc-text-primary'}`}
					>
						{detail.notice.subject}
					</h1>
					<div class="lc-text-secondary mt-3 flex flex-wrap gap-3 text-sm">
						<span class="lc-chip-muted inline-flex items-center rounded-md px-2 py-1">
							<FontAwesomeIcon icon={faUser} class="mr-1.5 h-3.5 w-3.5" />
							{detail.notice.proposerCategory}
						</span>
						{#if detail.notice.committee}
							<span class="lc-chip-muted inline-flex items-center rounded-md px-2 py-1">
								<FontAwesomeIcon icon={faBell} class="mr-1.5 h-3.5 w-3.5" />
								{detail.notice.committee}
							</span>
						{/if}
						<span class="lc-chip-success inline-flex items-center rounded-md px-2 py-1">
							<FontAwesomeIcon icon={faClock} class="mr-1.5 h-3.5 w-3.5" />
							아카이브: {formatDateTime(detail.archiveMetadata.archivedAt)}
						</span>
					</div>
				</div>
				<button
					on:click={() => openExternalLink(detail.notice.link)}
					class="lc-button-primary inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-semibold"
				>
					<FontAwesomeIcon icon={faExternalLink} class="mr-2 h-4 w-4" />
					국회 페이지 열기
				</button>
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
			<section class="lc-panel-card mb-6 rounded-2xl border p-6 shadow-sm">
				<div class="mb-4 flex items-center gap-2">
					<FontAwesomeIcon icon={faScaleBalanced} class="lc-text-accent h-5 w-5" />
					<h2 class="lc-text-primary text-lg font-bold">입법예고 정보</h2>
				</div>
				<dl class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each contentFacts as fact (fact.label)}
						<div class="lc-panel-inset rounded-lg border px-3 py-2">
							<dt class="lc-text-muted text-xs font-semibold">{fact.label}</dt>
							<dd class="lc-text-primary mt-1 text-sm font-medium">{fact.value}</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}

		<section class="lc-panel-card mb-6 rounded-2xl border p-6 shadow-sm">
			<div class="mb-4 flex items-center gap-2">
				<FontAwesomeIcon icon={faFileLines} class="lc-text-purple h-5 w-5" />
				<h2 class="lc-text-primary text-lg font-bold">제안이유 및 주요내용 원문</h2>
			</div>
			{#if detail.originalContent.proposalReason}
				<h3 class="lc-text-secondary mb-3 text-sm font-semibold">{detail.originalContent.title}</h3>
				<div class="lc-code-block rounded-lg border p-4">
					<p class="lc-text-primary text-sm leading-7 whitespace-pre-line">
						{detail.originalContent.proposalReason}
					</p>
				</div>
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

		<details
			bind:this={changeTimelineSection}
			bind:open={isChangeTimelineOpen}
			on:toggle={handleTimelineToggle}
			class="lc-panel-card mb-6 rounded-2xl border p-6 shadow-sm"
		>
			<summary
				class="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition-colors duration-200 hover:bg-[var(--lc-surface-hover)]"
			>
				<span class="flex items-center gap-2">
					<FontAwesomeIcon icon={faCodeCompare} class="lc-text-accent h-5 w-5" />
					<h2 class="lc-text-primary text-lg font-bold">변경 추적 타임라인</h2>
				</span>
				<span
					class="lc-button-neutral inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200"
				>
					<span
						class="inline-flex transition-transform duration-200"
						class:rotate-180={isChangeTimelineOpen}
					>
						<FontAwesomeIcon icon={faChevronDown} class="h-4 w-4" />
					</span>
				</span>
			</summary>

			{#if isChangeTimelineOpen}
				<div class="mt-4" in:slide={{ duration: 220 }} out:slide={{ duration: 160 }}>
					{#if changes.items.length === 0}
						<div class="lc-panel-inset rounded-lg border px-4 py-5 text-sm">
							아직 기록된 변경 이벤트가 없습니다.
						</div>
					{:else}
						<div class="space-y-3">
							{#each changes.items as event, eventIndex (event.id)}
								<details class="lc-panel-inset rounded-xl border" open={eventIndex === 0}>
									<summary
										class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"
									>
										<div class="min-w-0 space-y-1">
											<div class="flex flex-wrap items-center gap-2">
												<span
													class="lc-chip-blue inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
												>
													<FontAwesomeIcon icon={faRotate} class="mr-1.5 h-3 w-3" />
													리비전 #{event.eventHeight}
												</span>
												<span
													class="lc-chip-muted inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
												>
													{eventTypeLabel(event.eventType)}
												</span>
											</div>
											<p class="lc-text-secondary truncate text-xs">
												{formatDateTime(event.detectedAt)} · {toReadableSourceLabel(event.source)}
											</p>
										</div>
										<div class="lc-text-secondary text-xs">
											필드 {event.changedFieldCount}개 변경
										</div>
									</summary>

									<div
										class="space-y-3 border-t border-[var(--lc-border-soft)] px-4 py-3"
										in:fade={{ duration: 120 }}
										out:fade={{ duration: 90 }}
									>
										<div class="mb-1 grid gap-2 text-xs sm:grid-cols-2">
											<div class="lc-stat-tile rounded-lg border px-3 py-2">
												<p class="lc-text-muted">이벤트 해시</p>
												<p class="lc-text-primary mt-1 font-mono font-semibold">
													{shortenHash(event.eventHash)}
												</p>
											</div>
											<div class="lc-stat-tile rounded-lg border px-3 py-2">
												<p class="lc-text-muted">변경 시각</p>
												<p class="lc-text-primary mt-1 font-semibold">
													{formatDateTime(event.detectedAt)}
												</p>
											</div>
										</div>

										{#if event.details.length > 0}
											<div class="space-y-2">
												<p class="lc-text-secondary flex items-center gap-2 text-xs font-semibold">
													<FontAwesomeIcon icon={faListCheck} class="h-3.5 w-3.5" />
													리비전 변경 내역
												</p>
												<div class="space-y-2">
													{#each event.details as detailItem (detailItem.id)}
														{@const diffSegments = buildInlineDiffSegments(
															detailItem.beforeValue,
															detailItem.afterValue
														)}
														<div
															class="lc-code-block space-y-2 rounded-md border px-3 py-2 text-xs"
														>
															<div class="flex flex-wrap items-center gap-2">
																<span class="lc-chip-muted rounded-full px-2 py-0.5 font-semibold"
																	>{changeTypeLabel(detailItem.changeType)}</span
																>
																<span class="lc-text-primary font-semibold"
																	>{toReadableFieldLabel(detailItem.fieldPath)}</span
																>
															</div>
															<div class="grid gap-2 md:grid-cols-2">
																<div class="grid gap-1">
																	<p class="lc-text-muted">이전</p>
																	<div
																		class="rounded border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-2 py-1 font-mono leading-6 break-words whitespace-pre-wrap"
																	>
																		{#if detailItem.changeType === 'added'}
																			<span class="lc-text-dim">(없음)</span>
																		{:else if diffSegments.beforeSegments.length === 0}
																			<span class="lc-text-dim">(비어 있음)</span>
																		{:else}
																			{#each diffSegments.beforeSegments as segment, segmentIndex (`before-${detailItem.id}-${segmentIndex}`)}
																				<span
																					class={segment.kind === 'removed'
																						? 'lc-diff-removed'
																						: 'text-[var(--lc-text-primary)]'}
																				>
																					{segment.text}
																				</span>
																			{/each}
																		{/if}
																	</div>
																</div>
																<div class="grid gap-1">
																	<p class="lc-text-muted">현재</p>
																	<div
																		class="rounded border border-[var(--lc-border-soft)] bg-[var(--lc-surface-muted)] px-2 py-1 font-mono leading-6 break-words whitespace-pre-wrap"
																	>
																		{#if detailItem.changeType === 'removed'}
																			<span class="lc-text-dim">(없음)</span>
																		{:else if diffSegments.afterSegments.length === 0}
																			<span class="lc-text-dim">(비어 있음)</span>
																		{:else}
																			{#each diffSegments.afterSegments as segment, segmentIndex (`after-${detailItem.id}-${segmentIndex}`)}
																				<span
																					class={segment.kind === 'added'
																						? 'lc-diff-added'
																						: 'text-[var(--lc-text-primary)]'}
																				>
																					{segment.text}
																				</span>
																			{/each}
																		{/if}
																	</div>
																</div>
															</div>
														</div>
													{/each}
												</div>
											</div>
										{:else}
											<p class="lc-text-secondary text-xs">상세 필드 변경 데이터가 없습니다.</p>
										{/if}
									</div>
								</details>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</details>

		<details
			bind:open={isArchiveMetaOpen}
			class="lc-panel-card group rounded-2xl border p-6 shadow-sm"
		>
			<summary
				class="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition-colors duration-200 hover:bg-[var(--lc-surface-hover)]"
			>
				<span class="flex items-center gap-2">
					<FontAwesomeIcon icon={faShieldHalved} class="lc-text-success h-5 w-5" />
					<h2 class="lc-text-primary text-lg font-bold">아카이브 상세정보</h2>
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
