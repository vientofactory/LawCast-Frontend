<script lang="ts">
	import Alert from '#lib/components/Alert.svelte';
	import Header from '#lib/components/Header.svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { DiscussionThreadStatus } from '#lib/types/api.ts';
	import { faArrowLeft, faScaleBalanced, faRotateRight } from '@fortawesome/free-solid-svg-icons';
	import type {
		NoticeDetail,
		DiscussionThreadDetailResponse,
		DiscussionComment,
		DiscussionThread,
		CreateCommentPayload
	} from '#lib/types/api.ts';
	import { apiClient, getRateLimitRetryAfter, isRateLimitError } from '#lib/api/client.ts';
	import { toUserFacingErrorMessage } from '#lib/utils/error-message.util.ts';
	import ThreadDetailView from '#lib/components/discussions/ThreadDetailView.svelte';
	import ThreadDetailSkeleton from '#lib/components/discussions/ThreadDetailSkeleton.svelte';
	import LoadFailureState from '#lib/components/LoadFailureState.svelte';
	import {
		getFailureKind,
		getFailureStatus,
		type LoadErrorPayload
	} from '#lib/utils/request-failure.ts';
	import type { Component, ComponentProps } from 'svelte';
	import type CommentActionModal from '#lib/components/discussions/CommentActionModal.svelte';
	import type DiscussionPushConsentModal from '#lib/components/discussions/DiscussionPushConsentModal.svelte';

	let {
		data
	}: {
		data: {
			noticeNum: number;
			threadId: number;
			detail: NoticeDetail;
			discussion: DiscussionThreadDetailResponse | null;
			discussionError?: LoadErrorPayload;
		};
	} = $props();

	let discussionData: DiscussionThreadDetailResponse | null = $state(
		null
	) as DiscussionThreadDetailResponse | null;

	let detail = $derived(data.detail);
	let thread = $derived(
		discussionData?.thread ?? {
			id: data.threadId,
			noticeNum: data.noticeNum,
			title: '토론 스레드',
			status: DiscussionThreadStatus.OPEN,
			isLocked: false,
			authorNickname: '익명',
			authorIpMasked: '',
			commentCount: 0,
			createdAt: new Date(0).toISOString(),
			updatedAt: new Date(0).toISOString()
		}
	);

	let comments = $derived(discussionData?.comments ?? []);
	let isSubmittingComment = $state(false);
	let isActionModalOpen = $state(false);
	let actionModalMode: 'edit-comment' | 'delete-comment' | 'toggle-thread-status' =
		$state('delete-comment');
	let actionTargetComment: DiscussionComment | null = $state(null);
	let actionTargetThread: DiscussionThread | null = $state(null);
	let isSubmittingAction = $state(false);
	let actionErrorMessage = $state('');
	let CommentActionModalComponent: Component<ComponentProps<typeof CommentActionModal>> | null =
		$state(null);

	let DiscussionPushConsentModalComponent: Component<
		ComponentProps<typeof DiscussionPushConsentModal>
	> | null = $state(null);

	let errorMessage = $state('');
	let threadFailure = $state<LoadErrorPayload | null>(untrack(() => data.discussionError ?? null));
	let successMessage = $state('');
	let threadDetailViewComponent: ThreadDetailView | undefined = $state();
	let isLoading = $state(false);
	let isRetryingLoad = $state(false);
	let isLoadingMoreComments = $state(false);
	let rateLimitRemaining = $state(0);
	let rateLimitTimer: ReturnType<typeof setInterval> | null = $state(null);
	let isQuotePushConsentOpen = $state(false);
	let isWebPushAvailableByServer = $state(false);
	const quotePushDismissalKey = $derived(`lawcast-quote-push-dismissed:${data.threadId}`);
	const newThreadMarkerKey = $derived(`lawcast-new-discussion:${data.threadId}`);

	$effect(() => {
		discussionData = data.discussion;
		errorMessage = data.discussionError?.message ?? '';
		threadFailure = data.discussionError ?? null;
		const initialFailure = data.discussionError;
		untrack(() => {
			if (initialFailure?.status === 429) startRateLimitCooldown(initialFailure.retryAfter ?? 60);
			else {
				if (rateLimitTimer) clearInterval(rateLimitTimer);
				rateLimitRemaining = 0;
			}
		});
	});

	function canPromptForQuotePush(): boolean {
		return (
			typeof window !== 'undefined' &&
			isWebPushAvailableByServer &&
			'serviceWorker' in navigator &&
			'PushManager' in window &&
			'Notification' in window &&
			Notification.permission !== 'denied' &&
			localStorage.getItem(quotePushDismissalKey) !== '1'
		);
	}

	async function ensureQuotePushConsentModal(): Promise<void> {
		if (!isWebPushAvailableByServer) return;
		if (DiscussionPushConsentModalComponent) return;

		const mod = await import('#lib/components/discussions/DiscussionPushConsentModal.svelte');
		DiscussionPushConsentModalComponent = mod.default;
		await tick();
	}

	async function openQuotePushConsent(): Promise<void> {
		if (!isWebPushAvailableByServer) return;
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(quotePushDismissalKey);
		}
		await ensureQuotePushConsentModal();
		isQuotePushConsentOpen = true;
	}

	function showSuccess(msg: string) {
		successMessage = msg;
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

	onMount(async () => {
		try {
			const config = await apiClient.getWebPushPublicConfig();
			isWebPushAvailableByServer = config.enabled && !!config.publicKey;
		} catch {
			isWebPushAvailableByServer = false;
		}

		if (sessionStorage.getItem(newThreadMarkerKey) === '1') {
			sessionStorage.removeItem(newThreadMarkerKey);
			if (canPromptForQuotePush()) {
				void openQuotePushConsent();
			}
		}
	});

	onDestroy(() => {
		if (rateLimitTimer) clearInterval(rateLimitTimer);
	});

	function discussionErrorMessage(error: unknown, fallback: string): string {
		if (!isRateLimitError(error)) {
			if (rateLimitTimer) clearInterval(rateLimitTimer);
			rateLimitRemaining = 0;
			// Raw error text is logged by callers; the banner gets Korean guidance only.
			return toUserFacingErrorMessage(error, fallback);
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
		isRetryingLoad = true;
		errorMessage = '';
		try {
			discussionData = await apiClient.getDiscussionThread(data.threadId, { limit: 20 });
			errorMessage = '';
			threadFailure = null;
			if (rateLimitTimer) clearInterval(rateLimitTimer);
			rateLimitRemaining = 0;
		} catch (err: unknown) {
			console.error('Failed to reload discussion:', err);
			errorMessage = discussionErrorMessage(err, '토론 내용을 새로고침하지 못했습니다.');
			if (!isRateLimitError(err)) {
				if (rateLimitTimer) clearInterval(rateLimitTimer);
				rateLimitRemaining = 0;
			}
			threadFailure = {
				status: getFailureStatus(err),
				kind: getFailureKind(err),
				message: errorMessage
			};
		} finally {
			isLoading = false;
			isRetryingLoad = false;
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
			const mod = await import('#lib/components/discussions/CommentActionModal.svelte');
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

	let currentUrl = $state(page.url);

	afterNavigate(({ shallow, type }) => {
		if (shallow && type === 'goto') return;

		currentUrl = new URL(page.url.href);
	});

	let pageTitle = $derived(`${thread.title} - 의안 "${detail.notice.subject}" 토론`);
	let pageUrl = $derived(currentUrl.origin + currentUrl.pathname);
	let pageDescription = $derived(
		`의안번호 ${data.noticeNum} (${detail.notice.subject})에 대한 토론 스레드입니다.`
	);
	let pageKeywords = $derived(
		[detail.notice.subject, thread.title, '의안 토론', '법률안 토론', '토론 스레드', '입법예고']
			.filter(Boolean)
			.join(', ')
	);
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	url={pageUrl}
	keywords={pageKeywords}
	type="article"
/>

<div class="lc-page-shell">
	<Header />

	<main id="main-content" class="lc-main" aria-labelledby="discussion-thread-title">
		<!-- Breadcrumbs Navigation -->
		<nav class="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label="이동 경로">
			<a
				href={`/notices/${data.noticeNum}#notice-discussions`}
				class="lc-button-neutral inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="mr-1.5 h-3.5 w-3.5" />
				법률안 상세로 돌아가기
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<a
				href={`/notices/${data.noticeNum}`}
				class="lc-text-secondary hover:lc-text-primary max-w-xs truncate text-xs font-medium sm:max-w-md"
			>
				{detail.notice.subject}
			</a>
			<span class="lc-text-dim" aria-hidden="true">/</span>
			<span class="lc-text-primary max-w-[200px] truncate text-xs font-bold">
				토론 #{thread.id}
			</span>
		</nav>

		<!-- Secondary bill context, separate from the discussion content. -->
		<div class="lc-thread-context" data-testid="discussion-bill-context">
			<p class="lc-text-muted mb-3 text-sm font-semibold">토론 대상 법률안</p>
			<div class="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div class="w-full min-w-0 flex-1 space-y-1">
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
					<h1
						id="discussion-thread-title"
						class="lc-text-primary mt-3 text-lg leading-relaxed font-bold wrap-anywhere"
					>
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
						onclick={reloadThread}
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
			<Alert type="success" message={successMessage} onDismiss={() => (successMessage = '')} />
		{/if}

		{#if errorMessage && discussionData}
			<Alert
				type="error"
				message={errorMessage}
				onDismiss={() => (errorMessage = '')}
				testId="discussion-error-banner"
			/>
		{/if}

		<!-- Thread Detail View -->
		{#if discussionData}
			<section class="lc-discussion-body" aria-label="토론 본문">
				{#key thread.status}
					<ThreadDetailView
						bind:this={threadDetailViewComponent}
						{thread}
						{comments}
						{isSubmittingComment}
						isRateLimited={rateLimitRemaining > 0}
						{rateLimitRemaining}
						onRetryRateLimit={reloadThread}
						isRetryingRateLimit={isRetryingLoad}
						onLoadMoreComments={loadMoreComments}
						{isLoadingMoreComments}
						onBack={handleBack}
						onSubmitComment={handleAddComment}
						onEditComment={openEditCommentModal}
						onDeleteComment={openDeleteCommentModal}
						onToggleStatus={openToggleThreadStatusModal}
						onOpenQuotePushConsent={openQuotePushConsent}
						showQuotePushControl={isWebPushAvailableByServer}
					/>
				{/key}
			</section>
		{:else}
			<section
				class="lc-discussion-body relative"
				class:min-h-72={threadFailure?.status === 429}
				aria-label={threadFailure ? '토론 불러오기 실패' : '토론 불러오는 중'}
				aria-busy={isLoading || !threadFailure}
			>
				<LoadFailureState
					error={threadFailure}
					retryAfter={rateLimitRemaining}
					onRetry={reloadThread}
					isRetrying={isRetryingLoad}
				/>
				{#if !threadFailure}<ThreadDetailSkeleton />{/if}
			</section>
		{/if}
	</main>
</div>

{#if CommentActionModalComponent}
	<CommentActionModalComponent
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
	<DiscussionPushConsentModalComponent
		isOpen={isQuotePushConsentOpen}
		threadId={data.threadId}
		onClose={() => (isQuotePushConsentOpen = false)}
	/>
{/if}

<style>
	.lc-thread-context {
		padding: clamp(1rem, 2.5vw, 1.5rem);
		background: var(--lc-surface-muted);
		border-bottom: 1px solid var(--lc-border-soft);
	}

	.lc-discussion-body {
		min-width: 0;
		margin-top: clamp(1.5rem, 3vw, 2.5rem);
	}
</style>
