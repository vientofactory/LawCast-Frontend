<script lang="ts">
	import type { LoadErrorPayload } from '#lib/utils/request-failure.ts';
	import LoadFailureState from '#lib/components/LoadFailureState.svelte';
	import { getFailureKind, getFailureStatus } from '#lib/utils/request-failure.ts';
	import Alert from '#lib/components/Alert.svelte';
	import { onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faComments, faRotateRight } from '@fortawesome/free-solid-svg-icons';
	import { apiClient, getRateLimitRetryAfter, isRateLimitError } from '#lib/api/client.ts';
	import { toUserFacingErrorMessage } from '#lib/utils/error-message.util.ts';
	import type {
		DiscussionThread,
		DiscussionThreadListResponse,
		CreateThreadPayload
	} from '#lib/types/api.ts';
	import ThreadListView from './ThreadListView.svelte';
	import type { Component, ComponentProps } from 'svelte';
	import type NewThreadModal from './NewThreadModal.svelte';

	let {
		noticeNum,
		initialDiscussions = undefined,
		initialDiscussionError = undefined
	}: {
		noticeNum: number;
		initialDiscussions?: DiscussionThreadListResponse;
		initialDiscussionError?: LoadErrorPayload;
	} = $props();

	let threads: DiscussionThread[] = $state([]);
	let totalThreads = $state(0);
	let isLoadingThreads = $state(false);

	let isNewThreadModalOpen = $state(false);
	let isSubmittingNewThread = $state(false);
	let newThreadErrorMessage = $state('');
	let NewThreadModalComponent: Component<ComponentProps<typeof NewThreadModal>> | null =
		$state(null);

	let errorMessage = $state('');
	let listFailure = $state<LoadErrorPayload | null>(null);
	let successMessage = $state('');
	let rateLimitRemaining = $state(0);
	let rateLimitTimer: ReturnType<typeof setInterval> | null = $state(null);

	$effect(() => {
		threads = initialDiscussions?.items ?? [];
		totalThreads = initialDiscussions?.total ?? 0;
		errorMessage = initialDiscussionError?.message ?? '';
		listFailure = initialDiscussionError ?? null;
		const initialFailure = initialDiscussionError;
		untrack(() => {
			if (initialFailure?.status === 429) startRateLimitCooldown(initialFailure.retryAfter ?? 60);
			else {
				if (rateLimitTimer) clearInterval(rateLimitTimer);
				rateLimitRemaining = 0;
			}
		});
	});

	function showSuccess(msg: string) {
		successMessage = msg;
	}

	function discussionErrorMessage(error: unknown, fallback: string): string {
		if (!isRateLimitError(error)) {
			if (rateLimitTimer) clearInterval(rateLimitTimer);
			rateLimitRemaining = 0;
			// Raw error text is logged by callers; the banner gets Korean guidance only.
			return toUserFacingErrorMessage(error, fallback);
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

	async function loadThreads() {
		if (!noticeNum || noticeNum <= 0) return;
		isLoadingThreads = true;
		errorMessage = '';
		try {
			const res = await apiClient.getNoticeDiscussions(noticeNum);
			threads = res.items;
			totalThreads = res.total;
			listFailure = null;
			if (rateLimitTimer) clearInterval(rateLimitTimer);
			rateLimitRemaining = 0;
		} catch (err) {
			console.error('Failed to load discussions:', err);
			errorMessage = discussionErrorMessage(err, '토론 목록을 불러오지 못했습니다.');
			listFailure = {
				status: getFailureStatus(err),
				kind: getFailureKind(err),
				message: errorMessage
			};
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
		if (!initialDiscussions) {
			loadThreads();
		}
	});
</script>

<section id="notice-discussions" data-testid="notice-discussions" class="lc-section relative">
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
			onclick={loadThreads}
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
		<Alert type="success" message={successMessage} onDismiss={() => (successMessage = '')} />
	{/if}

	{#if errorMessage && !listFailure}
		<Alert
			type="error"
			message={errorMessage}
			onDismiss={() => (errorMessage = '')}
			testId="discussion-error-banner"
		/>
	{/if}

	<LoadFailureState
		error={listFailure && (listFailure.status !== 429 || rateLimitRemaining === 0)
			? listFailure
			: null}
		retryAfter={rateLimitRemaining}
		onRetry={loadThreads}
		isRetrying={isLoadingThreads}
	/>
	<ThreadListView
		{threads}
		total={totalThreads}
		isLoading={isLoadingThreads}
		{rateLimitRemaining}
		onOpenNewThreadModal={openNewThreadModal}
		onSelectThread={handleSelectThread}
	/>
</section>

<!-- Modals -->
{#if NewThreadModalComponent}
	<NewThreadModalComponent
		isOpen={isNewThreadModalOpen}
		isSubmitting={isSubmittingNewThread}
		isRateLimited={rateLimitRemaining > 0}
		externalErrorMessage={newThreadErrorMessage}
		onClose={() => (isNewThreadModalOpen = false)}
		onSubmit={handleCreateThread}
	/>
{/if}
