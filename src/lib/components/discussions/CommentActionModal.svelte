<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faKey,
		faPenToSquare,
		faTrash,
		faLock,
		faLockOpen,
		faXmark,
		faSpinner
	} from '@fortawesome/free-solid-svg-icons';
	import type { DiscussionComment, DiscussionThread } from '$lib/types/api';

	export let isOpen = false;
	export let mode: 'edit-comment' | 'delete-comment' | 'toggle-thread-status' = 'delete-comment';
	export let targetComment: DiscussionComment | null = null;
	export let targetThread: DiscussionThread | null = null;
	export let isSubmitting = false;
	export let externalErrorMessage = '';
	export let onSubmitEdit:
		((data: { commentId: number; password: string; content: string }) => void) | undefined =
		undefined;
	export let onSubmitDelete: ((data: { commentId: number; password: string }) => void) | undefined =
		undefined;
	export let onSubmitToggleStatus:
		| ((data: { threadId: number; password: string; status: 'open' | 'closed' }) => void)
		| undefined = undefined;
	export let onClose: (() => void) | undefined = undefined;

	let password = '';
	let editContent = '';
	let errorMessage = '';

	$: if (externalErrorMessage) {
		errorMessage = externalErrorMessage;
	}

	$: if (isOpen && targetComment && mode === 'edit-comment') {
		editContent = targetComment.content;
		password = '';
		errorMessage = externalErrorMessage || '';
	} else if (isOpen) {
		password = '';
		errorMessage = externalErrorMessage || '';
	}

	function handleClose() {
		if (isSubmitting) return;
		password = '';
		editContent = '';
		errorMessage = '';
		isOpen = false;
		onClose?.();
	}

	function handleSubmit() {
		errorMessage = '';
		if (!password || password.length < 4) {
			errorMessage = '비밀번호를 입력해주세요.';
			return;
		}

		if (mode === 'edit-comment' && targetComment) {
			if (!editContent.trim() || editContent.trim().length < 2) {
				errorMessage = '수정할 내용을 2자 이상 입력해주세요.';
				return;
			}
			onSubmitEdit?.({
				commentId: targetComment.id,
				password,
				content: editContent.trim()
			});
		} else if (mode === 'delete-comment' && targetComment) {
			onSubmitDelete?.({
				commentId: targetComment.id,
				password
			});
		} else if (mode === 'toggle-thread-status' && targetThread) {
			const nextStatus = targetThread.status === 'open' ? 'closed' : 'open';
			onSubmitToggleStatus?.({
				threadId: targetThread.id,
				password,
				status: nextStatus
			});
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen && !isSubmitting) {
			handleClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		role="dialog"
		aria-modal="true"
		transition:fade={{ duration: 180 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute inset-0" on:click={handleClose}></div>

		<div
			class="relative w-full max-w-md rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-6 shadow-xl"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div
				class="mb-4 flex items-center justify-between border-b border-[var(--lc-border-soft)] pb-3"
			>
				<div class="flex items-center gap-2">
					<div
						class={`rounded-lg p-2 ${
							mode === 'delete-comment'
								? 'bg-red-500/10 text-red-500'
								: mode === 'edit-comment'
									? 'lc-chip-blue'
									: 'lc-chip-warning'
						}`}
					>
						<FontAwesomeIcon
							icon={mode === 'delete-comment'
								? faTrash
								: mode === 'edit-comment'
									? faPenToSquare
									: targetThread?.status === 'open'
										? faLock
										: faLockOpen}
							class="h-4 w-4"
						/>
					</div>
					<div>
						<h2 class="lc-text-primary text-sm font-bold">
							{#if mode === 'edit-comment'}
								의견 수정 (#{targetComment?.sequence})
							{:else if mode === 'delete-comment'}
								의견 삭제 (#{targetComment?.sequence})
							{:else}
								토론 상태 변경 ({targetThread?.status === 'open' ? '토론 닫기' : '토론 다시 열기'})
							{/if}
						</h2>
						<p class="lc-text-muted text-xs">작성 시 등록했던 비밀번호를 입력해주세요.</p>
					</div>
				</div>
				<button
					type="button"
					on:click={handleClose}
					disabled={isSubmitting}
					class="lc-text-muted hover:lc-text-primary p-1.5 transition-colors"
					aria-label="닫기"
				>
					<FontAwesomeIcon icon={faXmark} class="h-4 w-4" />
				</button>
			</div>

			{#if errorMessage}
				<div
					class="lc-banner-danger mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
				>
					{errorMessage}
				</div>
			{/if}

			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				{#if mode === 'edit-comment'}
					<div>
						<label
							for="edit-comment-content"
							class="lc-text-primary mb-1 block text-xs font-semibold"
						>
							수정할 내용 <span class="text-red-500">*</span>
						</label>
						<textarea
							id="edit-comment-content"
							bind:value={editContent}
							disabled={isSubmitting}
							rows="4"
							maxlength="5000"
							class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-3 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
						></textarea>
						<div class="lc-text-dim mt-1 text-right text-xs">
							{editContent.length}/5000
						</div>
					</div>
				{:else if mode === 'delete-comment'}
					<div
						class="rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-inset)] p-3 text-xs leading-relaxed text-[var(--lc-text-secondary)]"
					>
						<p class="font-semibold text-red-500">안내</p>
						<p class="mt-1">
							토론 맥락 유지를 위해 의견 삭제 시 본문이 삭제된 상태로 보존(소프트 삭제)됩니다.
						</p>
					</div>
				{:else if mode === 'toggle-thread-status'}
					<div
						class="rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-inset)] p-3 text-xs leading-relaxed text-[var(--lc-text-secondary)]"
					>
						<p class="font-semibold text-[var(--lc-text-primary)]">안내</p>
						<p class="mt-1">
							{targetThread?.status === 'open'
								? '토론을 닫으면 추가 의견 작성이 제한됩니다. 토론 개설 시 입력한 비밀번호가 필요합니다.'
								: '닫힌 토론을 다시 열어 참여자가 추가 의견을 작성할 수 있도록 합니다.'}
						</p>
					</div>
				{/if}

				<div>
					<label
						for="action-password-input"
						class="lc-text-primary mb-1 block text-xs font-semibold"
					>
						<FontAwesomeIcon icon={faKey} class="mr-1 h-3 w-3" />
						비밀번호 <span class="text-red-500">*</span>
					</label>
					<input
						id="action-password-input"
						type="password"
						bind:value={password}
						disabled={isSubmitting}
						maxlength="64"
						placeholder="비밀번호 입력"
						class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-2 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						on:click={handleClose}
						disabled={isSubmitting}
						class="lc-button-neutral cursor-pointer rounded-lg border border-[var(--lc-border-soft)] px-4 py-2 text-xs font-semibold"
					>
						취소
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold ${
							mode === 'delete-comment'
								? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
								: 'lc-button-primary disabled:opacity-50'
						}`}
					>
						{#if isSubmitting}
							<FontAwesomeIcon icon={faSpinner} class="h-3 w-3 animate-spin" />
							<span>처리 중...</span>
						{:else if mode === 'edit-comment'}
							<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
							<span>수정 완료</span>
						{:else if mode === 'delete-comment'}
							<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
							<span>삭제 확인</span>
						{:else}
							<span>확인</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
