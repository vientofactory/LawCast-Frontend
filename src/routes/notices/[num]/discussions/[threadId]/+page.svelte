<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { DiscussionThreadStatus } from '$lib/types/api';
	import {
		faArrowLeft,
		faScaleBalanced,
		faCircleCheck,
		faCircleExclamation,
		faRotateRight
	} from '@fortawesome/free-solid-svg-icons';
	import type {
		NoticeDetail,
		DiscussionThreadDetailResponse,
		DiscussionComment,
		DiscussionThread,
		CreateCommentPayload
	} from '$lib/types/api';
	import { apiClient, getRateLimitRetryAfter, isRateLimitError } from '$lib/api/client';
	import ThreadDetailView from '$lib/components/discussions/ThreadDetailView.svelte';
	import type { Component, ComponentProps } from 'svelte';
	import type CommentActionModal from '$lib/components/discussions/CommentActionModal.svelte';
	import type DiscussionPushConsentModal from '$lib/components/discussions/DiscussionPushConsentModal.svelte';

	export let data: {
		noticeNum: number;
		threadId: number;
		detail: NoticeDetail;
		discussion: DiscussionThreadDetailResponse | null;
		discussionError?: {
			status: number;
			message: string;
			retryAfter?: number;
		};
	};

	let discussionData = data.discussion;

	$: detail = data.detail;
	$: thread = discussionData?.thread ?? {
		id: data.threadId,
		noticeNum: data.noticeNum,
		title: '토론 스레드',
		status: DiscussionThreadStatus.OPEN,
		authorNickname: '익명',
		authorIpMasked: '',
		commentCount: 0,
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString()
	};
	$: comments = discussionData?.comments ?? [];

	let isSubmittingComment = false;
	let isActionModalOpen = false;
	let actionModalMode: 'edit-comment' | 'delete-comment' | 'toggle-thread-status' =
		'delete-comment';
	let actionTargetComment: DiscussionComment | null = null;
	let actionTargetThread: DiscussionThread | null = null;
	let isSubmittingAction = false;
	let actionErrorMessage = '';
	let CommentActionModalComponent: Component<ComponentProps<typeof CommentActionModal>> | null =
		null;
	let DiscussionPushConsentModalComponent: Component<
		ComponentProps<typeof DiscussionPushConsentModal>
	> | null = null;

	let errorMessage = data.discussionError?.message ?? '';
	let successMessage = '';
	let successTimer: ReturnType<typeof setTimeout> | null = null;
	let threadDetailViewComponent: ThreadDetailView;
	let isLoading = false;
	let isLoadingMoreComments = false;
	let rateLimitRemaining = data.discussionError?.retryAfter ?? 0;
	let rateLimitTimer: ReturnType<typeof setInterval> | null = null;
	let isQuotePushConsentOpen = false;
	const quotePushDismissalKey = `lawcast-quote-push-dismissed:${data.threadId}`;
	const newThreadMarkerKey = `lawcast-new-discussion:${data.threadId}`;

	function canPromptForQuotePush(): boolean {
		return (
			typeof window !== 'undefined' &&
			'serviceWorker' in navigator &&
			'PushManager' in window &&
			'Notification' in window &&
			Notification.permission !== 'denied' &&
			localStorage.getItem(quotePushDismissalKey) !== '1'
		);
	}

	async function ensureQuotePushConsentModal(): Promise<void> {
		if (DiscussionPushConsentModalComponent) return;

		const mod = await import('$lib/components/discussions/DiscussionPushConsentModal.svelte');
		DiscussionPushConsentModalComponent = mod.default;
		await tick();
	}

	async function openQuotePushConsent(): Promise<void> {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(quotePushDismissalKey);
		}
		await ensureQuotePushConsentModal();
		isQuotePushConsentOpen = true;
	}

	function showSuccess(msg: string) {
		successMessage = msg;
		if (successTimer) clearTimeout(successTimer);
		successTimer = setTimeout(() => {
			successMessage = '';
		}, 3500);
	}

	function startRateLimitCooldown(seconds: number): void {
		rateLimitRemaining = seconds;
		if (rateLimitTimer) clearInterval(rateLimitTimer);
		rateLimitTimer = setInterval(() => {
			rateLimitRemaining = Math.max(0, rateLimitRemaining - 1);
			if (rateLimitRemaining === 0 && rateLimitTimer) {
				clearInterval(rateLimitTimer);
				rateLimitTimer = null;
			}
		}, 1000);
	}

	onMount(() => {
		if (data.discussionError) {
			startRateLimitCooldown(data.discussionError.retryAfter ?? 60);
		}
		if (sessionStorage.getItem(newThreadMarkerKey) === '1') {
			sessionStorage.removeItem(newThreadMarkerKey);
			if (canPromptForQuotePush()) {
				void openQuotePushConsent();
			}
		}
	});

	function discussionErrorMessage(error: unknown, fallback: string): string {
		if (!isRateLimitError(error)) {
			return error instanceof Error ? error.message : fallback;
		}

		rateLimitRemaining = getRateLimitRetryAfter(error);
		if (rateLimitTimer) clearInterval(rateLimitTimer);
		rateLimitTimer = setInterval(() => {
			rateLimitRemaining = Math.max(0, rateLimitRemaining - 1);
			if (rateLimitRemaining === 0 && rateLimitTimer) {
				clearInterval(rateLimitTimer);
				rateLimitTimer = null;
			}
		}, 1000);
		return `요청이 너무 많습니다. ${rateLimitRemaining}초 후 다시 시도해주세요.`;
	}

	async function reloadThread() {
		isLoading = true;
		errorMessage = '';
		try {
			discussionData = await apiClient.getDiscussionThread(data.threadId, { limit: 20 });
			errorMessage = '';
		} catch (err: unknown) {
			console.error('Failed to reload discussion:', err);
			errorMessage = discussionErrorMessage(err, '토론 내용을 새로고침하지 못했습니다.');
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreComments() {
		if (!discussionData || isLoadingMoreComments || discussionData.hasMore !== true) return;

		isLoadingMoreComments = true;
		try {
			const nextPage = await apiClient.getDiscussionThread(data.threadId, {
				cursor: discussionData.nextCursor ?? 0,
				limit: 20
			});
			const existingIds = new Set(discussionData.comments.map((comment) => comment.id));
			discussionData = {
				...discussionData,
				thread: nextPage.thread,
				comments: [
					...discussionData.comments,
					...nextPage.comments.filter((comment) => !existingIds.has(comment.id))
				],
				hasMore: nextPage.hasMore,
				nextCursor: nextPage.nextCursor
			};
		} catch (err: unknown) {
			console.error('Failed to load more discussion comments:', err);
			errorMessage = discussionErrorMessage(err, '추가 의견을 불러오지 못했습니다.');
		} finally {
			isLoadingMoreComments = false;
		}
	}

	function handleBack() {
		goto(`/notices/${data.noticeNum}#notice-discussions`);
	}

	async function handleAddComment(payload: CreateCommentPayload) {
		isSubmittingComment = true;
		errorMessage = '';
		if (!discussionData) {
			errorMessage = '토론 내용을 불러온 후 다시 시도해주세요.';
			isSubmittingComment = false;
			return;
		}
		try {
			const wasFirstOpinion = discussionData.comments.length === 1;
			const newComment = await apiClient.addDiscussionComment(data.threadId, payload);
			discussionData = {
				...discussionData,
				thread: {
					...discussionData.thread,
					commentCount: discussionData.thread.commentCount + 1
				},
				comments: [...discussionData.comments, newComment]
			};
			if (threadDetailViewComponent) {
				threadDetailViewComponent.clearReplyForm();
			}
			showSuccess('새 의견이 등록되었습니다.');
			if (wasFirstOpinion && canPromptForQuotePush()) {
				void openQuotePushConsent();
			}
		} catch (err: unknown) {
			console.error('Failed to add comment:', err);
			errorMessage = discussionErrorMessage(err, '의견 등록 중 오류가 발생했습니다.');
		} finally {
			isSubmittingComment = false;
		}
	}

	// Mount the modal with isOpen=false first so the intro transition still fires on first open.
	async function openActionModal(setup: () => void) {
		setup();
		actionErrorMessage = '';
		if (!CommentActionModalComponent) {
			const mod = await import('$lib/components/discussions/CommentActionModal.svelte');
			CommentActionModalComponent = mod.default;
			await tick();
		}
		isActionModalOpen = true;
	}

	function openEditCommentModal(comment: DiscussionComment) {
		openActionModal(() => {
			actionModalMode = 'edit-comment';
			actionTargetComment = comment;
			actionTargetThread = null;
		});
	}

	function openDeleteCommentModal(comment: DiscussionComment) {
		openActionModal(() => {
			actionModalMode = 'delete-comment';
			actionTargetComment = comment;
			actionTargetThread = null;
		});
	}

	function openToggleThreadStatusModal(targetThread: DiscussionThread) {
		openActionModal(() => {
			actionModalMode = 'toggle-thread-status';
			actionTargetThread = targetThread;
			actionTargetComment = null;
		});
	}

	async function handleSubmitEdit(editPayload: {
		commentId: number;
		password: string;
		content: string;
	}) {
		isSubmittingAction = true;
		actionErrorMessage = '';
		if (!discussionData) {
			actionErrorMessage = '토론 내용을 불러온 후 다시 시도해주세요.';
			isSubmittingAction = false;
			return;
		}
		try {
			const updated = await apiClient.updateDiscussionComment(editPayload.commentId, {
				password: editPayload.password,
				content: editPayload.content
			});
			discussionData = {
				...discussionData,
				comments: discussionData.comments.map((c) => (c.id === updated.id ? updated : c))
			};
			isActionModalOpen = false;
			showSuccess('의견이 성공적으로 수정되었습니다.');
		} catch (err: unknown) {
			console.error('Failed to edit comment:', err);
			actionErrorMessage = discussionErrorMessage(err, '의견 수정 중 오류가 발생했습니다.');
		} finally {
			isSubmittingAction = false;
		}
	}

	async function handleSubmitDelete(deletePayload: { commentId: number; password: string }) {
		isSubmittingAction = true;
		actionErrorMessage = '';
		if (!discussionData) {
			actionErrorMessage = '토론 내용을 불러온 후 다시 시도해주세요.';
			isSubmittingAction = false;
			return;
		}
		try {
			const deletedComment = await apiClient.deleteDiscussionComment(deletePayload.commentId, {
				password: deletePayload.password
			});
			discussionData = {
				...discussionData,
				comments: discussionData.comments.map((c) =>
					c.id === deletePayload.commentId ? deletedComment : c
				)
			};
			isActionModalOpen = false;
			showSuccess('의견이 삭제되었습니다.');
		} catch (err: unknown) {
			console.error('Failed to delete comment:', err);
			actionErrorMessage = discussionErrorMessage(err, '의견 삭제 중 오류가 발생했습니다.');
		} finally {
			isSubmittingAction = false;
		}
	}

	async function handleSubmitToggleStatus(statusPayload: {
		threadId: number;
		password: string;
		status: DiscussionThreadStatus;
	}) {
		isSubmittingAction = true;
		actionErrorMessage = '';
		if (!discussionData) {
			actionErrorMessage = '토론 내용을 불러온 후 다시 시도해주세요.';
			isSubmittingAction = false;
			return;
		}
		try {
			const updated = await apiClient.updateDiscussionThreadStatus(statusPayload.threadId, {
				password: statusPayload.password,
				status: statusPayload.status
			});
			const latestComments = await apiClient.getDiscussionThread(data.threadId, {
				cursor: Math.max(0, updated.commentCount - 1),
				limit: 20
			});
			const existingIds = new Set(discussionData.comments.map((comment) => comment.id));
			discussionData = {
				...discussionData,
				thread: updated,
				comments: [
					...discussionData.comments,
					...latestComments.comments.filter((comment) => !existingIds.has(comment.id))
				],
				hasMore: latestComments.hasMore,
				nextCursor: latestComments.nextCursor
			};
			isActionModalOpen = false;
			showSuccess(
				updated.status === DiscussionThreadStatus.OPEN
					? '토론이 다시 열렸습니다.'
					: '토론이 성공적으로 닫혔습니다.'
			);
		} catch (err: unknown) {
			console.error('Failed to update thread status:', err);
			actionErrorMessage = discussionErrorMessage(err, '상태 변경 중 오류가 발생했습니다.');
		} finally {
			isSubmittingAction = false;
		}
	}

	let currentUrl = page.url;
	afterNavigate(() => {
		currentUrl = page.url;
	});

	$: pageTitle = `${thread.title} - 의안 "${detail.notice.subject}" 토론 | LawCast`;
	$: pageUrl = currentUrl.origin + currentUrl.pathname;
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<link rel="canonical" href={pageUrl} />
	<meta
		name="description"
		content={`의안번호 ${data.noticeNum} (${detail.notice.subject})에 대한 토론 스레드입니다.`}
	/>
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={`의안번호 ${data.noticeNum} - ${thread.title}`} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={pageUrl} />
</svelte:head>

<div class="page-shell">
	<Header />

	<main
		id="main-content"
		class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
		aria-labelledby="discussion-thread-title"
	>
		<!-- Breadcrumbs Navigation -->
		<nav class="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label="이동 경로">
			<a
				href={`/notices/${data.noticeNum}#notice-discussions`}
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-1.5 transition-colors text-xs font-semibold"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-1.5 h-3.5 w-3.5" />
				법률안 상세로 돌아가기
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<a
				href={`/notices/${data.noticeNum}`}
				class="lc-text-secondary hover:lc-text-primary text-xs font-medium truncate max-w-xs sm:max-w-md"
			>
				{detail.notice.subject}
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<span class="lc-text-primary text-xs font-bold truncate max-w-[200px]">
				토론 #{thread.id}
			</span>
		</nav>

		<!-- Notice Context Header Card -->
		<div
			class="lc-panel-card mb-6 rounded-2xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-5 shadow-sm"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0 flex-1 space-y-1">
					<div class="flex flex-wrap items-center gap-2">
						<span
							class="lc-chip-blue inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
						>
							<FontAwesomeIcon icon={faScaleBalanced} class="h-3 w-3" />
							의안번호 {data.noticeNum}
						</span>
						{#if detail.notice.committee}
							<span class="lc-chip-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
								{detail.notice.committee}
							</span>
						{/if}
						<span class="lc-chip-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
							제안자 구분: {detail.notice.proposerCategory}
						</span>
					</div>
					<h1 class="lc-text-primary text-base font-bold truncate mt-3">
						{detail.notice.subject}
					</h1>
				</div>

				<div class="flex items-center gap-2">
					<a
						href={`/notices/${data.noticeNum}`}
						class="lc-button-neutral inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
					>
						법률안 원문 보기
					</a>
					<button
						type="button"
						on:click={reloadThread}
						disabled={isLoading || rateLimitRemaining > 0}
						title="새로고침"
						class="lc-button-neutral inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--lc-border-soft)] px-2.5 py-1.5 text-xs font-semibold"
					>
						<FontAwesomeIcon
							icon={faRotateRight}
							class={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
						/>
						<span class="hidden sm:inline">새로고침</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Feedback Alerts -->
		{#if successMessage}
			<div
				class="lc-banner-success mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs font-semibold"
			>
				<FontAwesomeIcon
					icon={faCircleCheck}
					class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
				/>
				<span>{successMessage}</span>
			</div>
		{/if}

		{#if errorMessage}
			<div
				class="lc-banner-danger mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
			>
				<FontAwesomeIcon icon={faCircleExclamation} class="h-4 w-4" />
				<span>{errorMessage}</span>
			</div>
		{/if}

		<!-- Thread Detail View -->
		{#if discussionData}
			<section
				class="lc-panel-card rounded-2xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-6"
			>
				{#key thread.status}
					<ThreadDetailView
						bind:this={threadDetailViewComponent}
						{thread}
						{comments}
						{isSubmittingComment}
						isRateLimited={rateLimitRemaining > 0}
						onLoadMoreComments={loadMoreComments}
						{isLoadingMoreComments}
						onBack={handleBack}
						onSubmitComment={handleAddComment}
						onEditComment={openEditCommentModal}
						onDeleteComment={openDeleteCommentModal}
						onToggleStatus={openToggleThreadStatusModal}
						onOpenQuotePushConsent={openQuotePushConsent}
					/>
				{/key}
			</section>
		{:else}
			<section class="lc-banner-warning rounded-2xl border p-6 text-center" aria-live="polite">
				<p class="text-sm font-semibold">토론을 잠시 불러올 수 없습니다.</p>
				<p class="mt-1 text-xs">
					{rateLimitRemaining > 0
						? `${rateLimitRemaining}초 후 다시 시도해주세요.`
						: '잠시 후 다시 시도해주세요.'}
				</p>
				<button
					type="button"
					on:click={reloadThread}
					disabled={isLoading || rateLimitRemaining > 0}
					class="lc-button-neutral mt-4 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
				>
					다시 시도
				</button>
			</section>
		{/if}
	</main>
</div>

{#if CommentActionModalComponent}
	<svelte:component
		this={CommentActionModalComponent}
		isOpen={isActionModalOpen && discussionData !== null}
		mode={actionModalMode}
		targetComment={actionTargetComment}
		targetThread={actionTargetThread}
		isSubmitting={isSubmittingAction}
		isRateLimited={rateLimitRemaining > 0}
		externalErrorMessage={actionErrorMessage}
		onClose={() => (isActionModalOpen = false)}
		onSubmitEdit={handleSubmitEdit}
		onSubmitDelete={handleSubmitDelete}
		onSubmitToggleStatus={handleSubmitToggleStatus}
	/>
{/if}

{#if DiscussionPushConsentModalComponent}
	<svelte:component
		this={DiscussionPushConsentModalComponent}
		isOpen={isQuotePushConsentOpen}
		threadId={data.threadId}
		onClose={() => (isQuotePushConsentOpen = false)}
	/>
{/if}
