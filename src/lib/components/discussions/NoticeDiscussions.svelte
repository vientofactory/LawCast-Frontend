<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faComments,
		faCircleExclamation,
		faCircleCheck,
		faRotateRight
	} from '@fortawesome/free-solid-svg-icons';
	import { apiClient, getRateLimitRetryAfter, isRateLimitError } from '$lib/api/client';
	import type {
		DiscussionThread,
		DiscussionThreadListResponse,
		CreateThreadPayload
	} from '$lib/types/api';
	import ThreadListView from './ThreadListView.svelte';
	import type { Component, ComponentProps } from 'svelte';
	import type NewThreadModal from './NewThreadModal.svelte';

	export let noticeNum: number;
	export let initialDiscussions: DiscussionThreadListResponse | undefined = undefined;
	export let initialDiscussionError:
		{ status: number; message: string; retryAfter?: number } | undefined = undefined;

	let threads: DiscussionThread[] = initialDiscussions?.items ?? [];
	let totalThreads = initialDiscussions?.total ?? 0;
	let isLoadingThreads = false;

	let isNewThreadModalOpen = false;
	let isSubmittingNewThread = false;
	let newThreadErrorMessage = '';
	let NewThreadModalComponent: Component<ComponentProps<typeof NewThreadModal>> | null = null;

	let errorMessage = initialDiscussionError?.message ?? '';
	let successMessage = '';
	let successTimer: ReturnType<typeof setTimeout> | null = null;
	let rateLimitRemaining = initialDiscussionError?.retryAfter ?? 0;
	let rateLimitTimer: ReturnType<typeof setInterval> | null = null;

	function showSuccess(msg: string) {
		successMessage = msg;
		if (successTimer) clearTimeout(successTimer);
		successTimer = setTimeout(() => {
			successMessage = '';
		}, 3500);
	}

	function discussionErrorMessage(error: unknown, fallback: string): string {
		if (!isRateLimitError(error)) {
			return error instanceof Error ? error.message : fallback;
		}

		const retryAfter = getRateLimitRetryAfter(error);
		startRateLimitCooldown(retryAfter);
		return `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도해주세요.`;
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

	$: if (initialDiscussions && threads.length === 0 && totalThreads === 0) {
		threads = initialDiscussions.items;
		totalThreads = initialDiscussions.total;
	}

	async function loadThreads() {
		if (!noticeNum || noticeNum <= 0) return;
		isLoadingThreads = true;
		errorMessage = '';
		try {
			const res = await apiClient.getNoticeDiscussions(noticeNum);
			threads = res.items;
			totalThreads = res.total;
		} catch (err) {
			console.error('Failed to load discussions:', err);
			errorMessage = discussionErrorMessage(err, '토론 목록을 불러오지 못했습니다.');
		} finally {
			isLoadingThreads = false;
		}
	}

	// Mount the modal with isOpen=false first so the intro transition still fires on first open.
	async function openNewThreadModal() {
		newThreadErrorMessage = '';
		if (!NewThreadModalComponent) {
			const mod = await import('./NewThreadModal.svelte');
			NewThreadModalComponent = mod.default;
			await tick();
		}
		isNewThreadModalOpen = true;
	}

	function handleSelectThread(threadId: number) {
		goto(`/notices/${noticeNum}/discussions/${threadId}`);
	}

	async function handleCreateThread(payload: CreateThreadPayload) {
		isSubmittingNewThread = true;
		newThreadErrorMessage = '';
		errorMessage = '';
		try {
			const res = await apiClient.createNoticeDiscussion(noticeNum, payload);
			isNewThreadModalOpen = false;
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.setItem(`lawcast-new-discussion:${res.thread.id}`, '1');
			}
			showSuccess('새 토론 주제가 성공적으로 개설되었습니다.');
			await goto(`/notices/${noticeNum}/discussions/${res.thread.id}`);
		} catch (err: unknown) {
			console.error('Failed to create thread:', err);
			newThreadErrorMessage = discussionErrorMessage(err, '토론 개설 중 오류가 발생했습니다.');
		} finally {
			isSubmittingNewThread = false;
		}
	}

	onMount(() => {
		if (initialDiscussionError) {
			startRateLimitCooldown(initialDiscussionError.retryAfter ?? 60);
		}
		if (!initialDiscussions) {
			loadThreads();
		}
	});
</script>

<section
	id="notice-discussions"
	data-testid="notice-discussions"
	class="lc-panel-card mt-6 mb-6 rounded-2xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-6 shadow-sm"
>
	<div class="mb-4 flex items-center justify-between border-b border-[var(--lc-border-soft)] pb-4">
		<div class="flex items-center gap-2.5">
			<div class="lc-chip-blue rounded-xl p-2.5">
				<FontAwesomeIcon icon={faComments} class="h-5 w-5" />
			</div>
			<div>
				<h2 class="lc-text-primary text-lg font-bold">의견 및 토론</h2>
				<p class="lc-text-muted text-xs">해당 법률안에 대한 의견과 토론을 나누는 공간입니다.</p>
			</div>
		</div>
		<button
			type="button"
			on:click={loadThreads}
			disabled={isLoadingThreads || rateLimitRemaining > 0}
			title="새로고침"
			class="lc-button-neutral inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--lc-border-soft)] px-2.5 py-1.5 text-xs font-semibold"
		>
			<FontAwesomeIcon
				icon={faRotateRight}
				class={`h-3.5 w-3.5 ${isLoadingThreads ? 'animate-spin' : ''}`}
			/>
			<span class="hidden sm:inline">새로고침</span>
		</button>
	</div>

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

	<ThreadListView
		{threads}
		total={totalThreads}
		isLoading={isLoadingThreads}
		hasError={Boolean(errorMessage || initialDiscussionError)}
		{rateLimitRemaining}
		onOpenNewThreadModal={openNewThreadModal}
		onSelectThread={handleSelectThread}
	/>
</section>

<!-- Modals -->
{#if NewThreadModalComponent}
	<svelte:component
		this={NewThreadModalComponent}
		isOpen={isNewThreadModalOpen}
		isSubmitting={isSubmittingNewThread}
		isRateLimited={rateLimitRemaining > 0}
		externalErrorMessage={newThreadErrorMessage}
		onClose={() => (isNewThreadModalOpen = false)}
		onSubmit={handleCreateThread}
	/>
{/if}
