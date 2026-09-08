<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { onMount } from 'svelte';
	import {
		faArrowLeft,
		faComments,
		faLock,
		faLockOpen,
		faPaperPlane,
		faBell,
		faUser,
		faKey,
		faSpinner
	} from '@fortawesome/free-solid-svg-icons';
	import {
		DiscussionThreadStatus,
		type DiscussionComment,
		type DiscussionThread,
		type CreateCommentPayload
	} from '$lib/types/api';
	import CommentItem from './CommentItem.svelte';

	export let thread: DiscussionThread;
	export let comments: DiscussionComment[] = [];
	export let isSubmittingComment = false;
	export let isRateLimited = false;
	export let onBack: (() => void) | undefined = undefined;
	export let onSubmitComment: ((payload: CreateCommentPayload) => void) | undefined = undefined;
	export let onEditComment: ((comment: DiscussionComment) => void) | undefined = undefined;
	export let onDeleteComment: ((comment: DiscussionComment) => void) | undefined = undefined;
	export let onToggleStatus: ((thread: DiscussionThread) => void) | undefined = undefined;
	export let onOpenQuotePushConsent: (() => void) | undefined = undefined;
	export let onLoadMoreComments: (() => void | Promise<void>) | undefined = undefined;
	export let isLoadingMoreComments = false;

	let replyNickname = '';
	let replyPassword = '';
	let replyContent = '';
	let replyErrorMessage = '';
	let commentsLoadSentinel: HTMLDivElement;

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isLoadingMoreComments) {
					void onLoadMoreComments?.();
				}
			},
			{ rootMargin: '320px 0px' }
		);
		if (commentsLoadSentinel) observer.observe(commentsLoadSentinel);
		return () => observer.disconnect();
	});

	function handleBack() {
		onBack?.();
	}

	function handleQuote(detail: { sequence: number; nickname: string }) {
		const { sequence } = detail;
		const quoteTag = `>>#${sequence}\n`;
		if (!replyContent.includes(quoteTag.trim())) {
			replyContent = `${quoteTag}${replyContent}`;
		}
		// Scroll to reply input
		const textarea = document.getElementById('reply-content-input');
		if (textarea) {
			textarea.focus();
		}
	}

	function handleCommentSubmit() {
		replyErrorMessage = '';
		if (!replyPassword || replyPassword.length < 4) {
			replyErrorMessage = '비밀번호를 4자 이상 입력해주세요 (수정/삭제 시 필요).';
			return;
		}
		if (!replyContent.trim() || replyContent.trim().length < 2) {
			replyErrorMessage = '의견 본문을 2자 이상 입력해주세요.';
			return;
		}

		onSubmitComment?.({
			authorNickname: replyNickname.trim() || undefined,
			password: replyPassword,
			content: replyContent.trim()
		});
	}

	export function clearReplyForm() {
		replyNickname = '';
		replyPassword = '';
		replyContent = '';
		replyErrorMessage = '';
	}
</script>

<div class="space-y-4" data-testid="discussion-thread-detail">
	<!-- Top Navigation and Thread Header -->
	<div class="flex items-center justify-between gap-3 border-b border-[var(--lc-border-soft)] pb-3">
		<button
			type="button"
			on:click={handleBack}
			class="lc-button-neutral inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--lc-border-soft)] px-3 py-1.5 text-xs font-semibold"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-3 w-3" />
			목록으로
		</button>
		<div class="flex items-center gap-2">
			<button
				type="button"
				on:click={() => onOpenQuotePushConsent?.()}
				class="lc-button-neutral inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--lc-border-soft)] px-2.5 py-1 text-xs font-medium"
				data-testid="discussion-quote-push-settings"
				title="인용 알림 설정"
			>
				<FontAwesomeIcon icon={faBell} class="h-3 w-3" />
				<span class="hidden sm:inline">인용 알림</span>
			</button>
			<button
				type="button"
				on:click={() => onToggleStatus?.(thread)}
				class="lc-button-neutral inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--lc-border-soft)] px-2.5 py-1 text-xs font-medium"
			>
				<FontAwesomeIcon
					icon={thread.status === DiscussionThreadStatus.OPEN ? faLock : faLockOpen}
					class="h-3 w-3"
				/>
				{thread.status === DiscussionThreadStatus.OPEN ? '토론 닫기' : '토론 다시 열기'}
			</button>
		</div>
	</div>

	<!-- Thread Info Box -->
	<div
		data-testid="discussion-thread-summary"
		class="rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-4 shadow-sm"
	>
		<div class="flex flex-wrap items-center gap-2">
			{#if thread.status === DiscussionThreadStatus.OPEN}
				<span
					class="lc-chip-success inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
				>
					<span class="lc-dot-success h-1.5 w-1.5 rounded-full"></span>
					토론 진행 중
				</span>
			{:else}
				<span
					class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
				>
					<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
					토론 닫힘
				</span>
			{/if}
			<span
				class="lc-chip-blue inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
			>
				<FontAwesomeIcon icon={faComments} class="h-2.5 w-2.5" />
				의견 {thread.commentCount}개
			</span>
		</div>
		<h2 class="lc-text-primary mt-2 text-lg font-bold">
			{thread.title}
		</h2>
		<div class="lc-text-muted mt-1 flex flex-wrap items-center gap-2 text-xs">
			<span
				>작성자: <strong class="text-[var(--lc-text-primary)]">{thread.authorNickname}</strong
				></span
			>
			<span class="font-mono">({thread.authorIpMasked})</span>
		</div>
	</div>

	<!-- Comments List -->
	<div class="space-y-3" data-testid="discussion-comment-list">
		{#each comments as comment (comment.id)}
			<CommentItem
				{comment}
				allComments={comments}
				isThreadClosed={thread.status === DiscussionThreadStatus.CLOSED}
				onQuote={handleQuote}
				onEdit={(c) => onEditComment?.(c)}
				onDelete={(c) => onDeleteComment?.(c)}
			/>
		{/each}
	</div>
	<div bind:this={commentsLoadSentinel} class="min-h-8" aria-live="polite">
		{#if isLoadingMoreComments}
			<div
				class="space-y-3 py-1"
				data-testid="discussion-comment-skeletons"
				aria-label="의견을 불러오는 중"
			>
				{#each [0, 1, 2] as skeleton (skeleton)}
					<div
						class="rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-4"
						aria-hidden="true"
					>
						<div
							class="mb-2.5 flex items-center justify-between gap-3 border-b border-[var(--lc-border-soft)] pb-2.5"
						>
							<div class="flex items-center gap-2">
								<div class="h-5 w-10 animate-pulse rounded-md bg-[var(--lc-surface-muted)]"></div>
								<div class="h-3 w-20 animate-pulse rounded bg-[var(--lc-surface-muted)]"></div>
								<div class="h-3 w-24 animate-pulse rounded bg-[var(--lc-surface-muted)]"></div>
							</div>
							<div class="h-3 w-16 animate-pulse rounded bg-[var(--lc-surface-muted)]"></div>
						</div>
						<div class="space-y-2" style={`animation-delay: ${skeleton * 90}ms`}>
							<div class="h-3 w-11/12 animate-pulse rounded bg-[var(--lc-surface-muted)]"></div>
							<div class="h-3 w-4/5 animate-pulse rounded bg-[var(--lc-surface-muted)]"></div>
							<div class="h-3 w-2/5 animate-pulse rounded bg-[var(--lc-surface-muted)]"></div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Reply Box -->
	{#if thread.status === DiscussionThreadStatus.OPEN}
		<div
			data-testid="discussion-reply-form"
			class="mt-6 rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-4 shadow-sm"
		>
			<h3 class="lc-text-primary mb-3 text-xs font-bold">새 의견 작성</h3>

			{#if replyErrorMessage}
				<div
					data-testid="discussion-reply-error"
					class="lc-banner-danger mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400"
				>
					{replyErrorMessage}
				</div>
			{/if}

			<form on:submit|preventDefault={handleCommentSubmit} class="space-y-3">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div>
						<label
							for="reply-nickname-input"
							class="lc-text-primary mb-1 block text-xs font-semibold"
						>
							<FontAwesomeIcon icon={faUser} class="mr-1 h-3 w-3" />
							닉네임 (미입력 시 '익명')
						</label>
						<input
							id="reply-nickname-input"
							data-testid="discussion-reply-nickname"
							type="text"
							bind:value={replyNickname}
							disabled={isSubmittingComment || isRateLimited}
							maxlength="30"
							placeholder="익명"
							class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-1.5 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label
							for="reply-password-input"
							class="lc-text-primary mb-1 block text-xs font-semibold"
						>
							<FontAwesomeIcon icon={faKey} class="mr-1 h-3 w-3" />
							비밀번호 (수정/삭제용) <span class="text-red-500">*</span>
						</label>
						<input
							id="reply-password-input"
							data-testid="discussion-reply-password"
							type="password"
							bind:value={replyPassword}
							disabled={isSubmittingComment || isRateLimited}
							minlength="4"
							maxlength="64"
							placeholder="4자 이상"
							class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-1.5 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="reply-content-input" class="lc-text-primary mb-1 block text-xs font-semibold">
						의견 내용 <span class="text-red-500">*</span>
					</label>
					<textarea
						id="reply-content-input"
						data-testid="discussion-reply-content"
						bind:value={replyContent}
						disabled={isSubmittingComment || isRateLimited}
						rows="4"
						maxlength="5000"
						placeholder="이 토론에 대한 의견을 작성해주세요. (상단 의견의 '인용' 버튼으로 이전 의견을 인용할 수 있습니다.)"
						class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-3 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
					></textarea>
					<div class="lc-text-dim mt-1 flex justify-between text-xs">
						<span>* 작성자 식별을 위해 IP 주소 일부(예: 123.45.***.***)가 표시됩니다.</span>
						<span>{replyContent.length}/5000</span>
					</div>
				</div>

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={isSubmittingComment || isRateLimited}
						data-testid="discussion-reply-submit"
						class="lc-button-primary inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
					>
						{#if isSubmittingComment}
							<FontAwesomeIcon icon={faSpinner} class="h-3 w-3 animate-spin" />
							<span>등록 중...</span>
						{:else if isRateLimited}
							<span>잠시 후 다시 시도</span>
						{:else}
							<FontAwesomeIcon icon={faPaperPlane} class="h-3 w-3" />
							<span>의견 등록하기</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	{:else}
		<div
			class="mt-4 rounded-xl border border-(--lc-border-soft) bg-(--lc-surface-muted) p-4 text-center text-xs text-(--lc-text-muted)"
		>
			<div class="flex items-center justify-center gap-1.5">
				<FontAwesomeIcon icon={faLock} class="h-3.5 w-3.5 shrink-0" />
				<span>이 토론은 닫혔으므로 새 의견을 작성할 수 없습니다.</span>
			</div>
		</div>
	{/if}
</div>
