<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
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
	import CommentActionModal from '$lib/components/discussions/CommentActionModal.svelte';

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

	let errorMessage = data.discussionError?.message ?? '';
	let successMessage = '';
	let successTimer: ReturnType<typeof setTimeout> | null = null;
	let threadDetailViewComponent: ThreadDetailView;
	let isLoading = false;
	let rateLimitRemaining = data.discussionError?.retryAfter ?? 0;
	let rateLimitTimer: ReturnType<typeof setInterval> | null = null;

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
			discussionData = await apiClient.getDiscussionThread(data.threadId);
			errorMessage = '';
		} catch (err: unknown) {
			console.error('Failed to reload discussion:', err);
			errorMessage = discussionErrorMessage(err, '토론 내용을 새로고침하지 못했습니다.');
		} finally {
			isLoading = false;
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
			const newComment = await apiClient.addDiscussionComment(data.threadId, payload);
			discussionData = {
				...discussionData,
				thread: {
					...discussionData.thread,
					commentCount: discussionData.comments.length + 1
				},
				comments: [...discussionData.comments, newComment]
			};
			if (threadDetailViewComponent) {
				threadDetailViewComponent.clearReplyForm();
			}
			showSuccess('새 의견이 등록되었습니다.');
		} catch (err: unknown) {
			console.error('Failed to add comment:', err);
			errorMessage = discussionErrorMessage(err, '의견 등록 중 오류가 발생했습니다.');
		} finally {
			isSubmittingComment = false;
		}
	}

	function openEditCommentModal(comment: DiscussionComment) {
		actionModalMode = 'edit-comment';
		actionTargetComment = comment;
		actionTargetThread = null;
		actionErrorMessage = '';
		isActionModalOpen = true;
	}

	function openDeleteCommentModal(comment: DiscussionComment) {
		actionModalMode = 'delete-comment';
		actionTargetComment = comment;
		actionTargetThread = null;
		actionErrorMessage = '';
		isActionModalOpen = true;
	}

	function openToggleThreadStatusModal(targetThread: DiscussionThread) {
		actionModalMode = 'toggle-thread-status';
		actionTargetThread = targetThread;
		actionTargetComment = null;
		actionErrorMessage = '';
		isActionModalOpen = true;
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
			discussionData = {
				...discussionData,
				thread: updated
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
				<ThreadDetailView
					bind:this={threadDetailViewComponent}
					{thread}
					{comments}
					{isSubmittingComment}
					isRateLimited={rateLimitRemaining > 0}
					onBack={handleBack}
					onSubmitComment={handleAddComment}
					onEditComment={openEditCommentModal}
					onDeleteComment={openDeleteCommentModal}
					onToggleStatus={openToggleThreadStatusModal}
				/>
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

<CommentActionModal
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
