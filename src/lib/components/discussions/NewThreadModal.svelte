<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faComments,
		faLock,
		faPaperPlane,
		faUser,
		faSpinner
	} from '@fortawesome/free-solid-svg-icons';
	import type { CreateThreadPayload } from '$lib/types/api';
	import ModalShell from '$lib/components/ModalShell.svelte';

	export let isOpen = false;
	export let isSubmitting = false;
	export let isRateLimited = false;
	export let externalErrorMessage = '';
	export let onSubmit: ((payload: CreateThreadPayload) => void) | undefined = undefined;
	export let onClose: (() => void) | undefined = undefined;

	let title = '';
	let authorNickname = '';
	let password = '';
	let content = '';
	let errorMessage = '';

	$: if (externalErrorMessage) {
		errorMessage = externalErrorMessage;
	}

	$: if (isOpen) {
		if (!externalErrorMessage) {
			errorMessage = '';
		}
	}

	function handleClose() {
		if (isSubmitting) return;
		title = '';
		authorNickname = '';
		password = '';
		content = '';
		errorMessage = '';
		isOpen = false;
		onClose?.();
	}

	function handleSubmit() {
		errorMessage = '';
		if (!title.trim() || title.trim().length < 2) {
			errorMessage = '토론 주제를 2자 이상 입력해주세요.';
			return;
		}
		if (!password || password.length < 4) {
			errorMessage = '비밀번호를 4자 이상 입력해주세요 (수정/삭제 시 필요).';
			return;
		}
		if (!content.trim() || content.trim().length < 2) {
			errorMessage = '첫 발언 내용을 2자 이상 입력해주세요.';
			return;
		}

		onSubmit?.({
			title: title.trim(),
			authorNickname: authorNickname.trim() || undefined,
			password,
			content: content.trim()
		});
	}
</script>

<ModalShell
	{isOpen}
	labelledBy="new-thread-title"
	closeDisabled={isSubmitting}
	onClose={handleClose}
>
	<div slot="icon" class="lc-chip-blue rounded-lg">
		<FontAwesomeIcon icon={faComments} class="h-4 w-4" />
	</div>
	<span slot="title">새 토론 주제 개설</span>
	<span slot="subtitle">법률안에 대한 새로운 토론 주제를 등록합니다.</span>

	{#if errorMessage}
		<div
			class="lc-banner-danger mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
		>
			{errorMessage}
		</div>
	{/if}

	<form on:submit|preventDefault={handleSubmit} class="space-y-4">
		<div>
			<label for="thread-title-input" class="lc-text-primary mb-1 block text-xs font-semibold">
				토론 주제 <span class="text-red-500">*</span>
			</label>
			<input
				id="thread-title-input"
				type="text"
				bind:value={title}
				disabled={isSubmitting || isRateLimited}
				maxlength="150"
				placeholder="예: ○○ 개정안의 실효성에 대한 의견"
				class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-2 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
			/>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div>
				<label for="thread-author-input" class="lc-text-primary mb-1 block text-xs font-semibold">
					<FontAwesomeIcon icon={faUser} class="mr-1 h-3 w-3" />
					닉네임 (미입력 시 '익명')
				</label>
				<input
					id="thread-author-input"
					type="text"
					bind:value={authorNickname}
					disabled={isSubmitting}
					maxlength="30"
					placeholder="익명"
					class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-2 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="thread-password-input" class="lc-text-primary mb-1 block text-xs font-semibold">
					<FontAwesomeIcon icon={faLock} class="mr-1 h-3 w-3" />
					비밀번호 (수정/삭제용) <span class="text-red-500">*</span>
				</label>
				<input
					id="thread-password-input"
					type="password"
					bind:value={password}
					disabled={isSubmitting}
					minlength="4"
					maxlength="64"
					placeholder="4자 이상"
					class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-2 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
				/>
			</div>
		</div>

		<div>
			<label for="thread-content-input" class="lc-text-primary mb-1 block text-xs font-semibold">
				첫 번째 의견 내용 <span class="text-red-500">*</span>
			</label>
			<textarea
				id="thread-content-input"
				bind:value={content}
				disabled={isSubmitting}
				rows="5"
				maxlength="5000"
				placeholder="토론을 시작하는 이유와 의견을 작성해주세요."
				class="w-full rounded-lg border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-3 text-sm text-[var(--lc-text-primary)] placeholder-[var(--lc-text-dim)] focus:border-blue-500 focus:outline-none"
			></textarea>
			<div class="lc-text-dim mt-1 flex justify-between text-xs">
				<span>* 작성자 식별을 위해 IP 주소 일부(예: 123.45.***.***)가 표시됩니다.</span>
				<span>{content.length}/5000</span>
			</div>
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
				disabled={isSubmitting || isRateLimited}
				class="lc-button-primary inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
			>
				{#if isSubmitting}
					<FontAwesomeIcon icon={faSpinner} class="h-3 w-3 animate-spin" />
					<span>개설 중...</span>
				{:else}
					<FontAwesomeIcon icon={faPaperPlane} class="h-3 w-3" />
					<span>토론 개설하기</span>
				{/if}
			</button>
		</div>
	</form>
</ModalShell>
