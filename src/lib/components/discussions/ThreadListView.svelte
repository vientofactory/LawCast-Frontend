<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faComments,
		faLock,
		faPlus,
		faUser,
		faClock,
		faChevronRight
	} from '@fortawesome/free-solid-svg-icons';
	import { DiscussionThreadStatus, type DiscussionThread } from '$lib/types/api';
	import { formatDateTimeKST } from '$lib/utils/helpers';

	export let threads: DiscussionThread[] = [];
	export let total = 0;
	export let isLoading = false;
	export let hasError = false;
	export let rateLimitRemaining = 0;
	export let onOpenNewThreadModal: (() => void) | undefined = undefined;
	export let onSelectThread: ((threadId: number) => void) | undefined = undefined;
</script>

<div class="space-y-4" data-testid="discussion-thread-list">
	{#if !hasError}
		<!-- Top Bar -->
		<div
			class="flex items-center justify-between gap-2 border-b border-[var(--lc-border-soft)] pb-3"
		>
			<div class="flex items-center gap-2">
				<span class="lc-text-primary text-sm font-bold"> 토론 목록 </span>
				<span class="lc-chip-blue rounded-full px-2 py-0.5 text-xs font-semibold">
					{total}개
				</span>
			</div>
			<button
				type="button"
				on:click={() => onOpenNewThreadModal?.()}
				data-testid="discussion-new-thread-button"
				class="lc-button-primary inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
			>
				<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
				새 토론 시작
			</button>
		</div>
	{/if}

	<!-- Thread List -->
	{#if isLoading}
		<div class="flex items-center justify-center p-8 text-xs text-[var(--lc-text-muted)]">
			토론 목록을 불러오는 중...
		</div>
	{:else if hasError}
		<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
			<p class="text-sm font-semibold text-red-700 dark:text-red-300">
				토론 목록을 불러오지 못했습니다.
			</p>
			<p class="mt-1 text-xs text-red-600 dark:text-red-400">잠시 후 새로고침해주세요.</p>
			{#if rateLimitRemaining > 0}
				<p class="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
					{rateLimitRemaining}초 후 다시 시도할 수 있습니다.
				</p>
			{/if}
		</div>
	{:else if threads.length === 0}
		<div
			data-testid="discussion-empty-state"
			class="rounded-xl border border-dashed border-[var(--lc-border-soft)] p-8 text-center"
		>
			<p class="lc-text-primary text-sm font-semibold">아직 등록된 토론이 없습니다.</p>
			<p class="lc-text-muted mt-1 text-xs">이 법률안에 대한 첫 번째 토론을 시작해보세요.</p>
			<button
				type="button"
				on:click={() => onOpenNewThreadModal?.()}
				class="lc-button-primary mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold"
			>
				<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
				첫 번째 토론 시작하기
			</button>
		</div>
	{:else}
		<div
			class="divide-y divide-[var(--lc-border-soft)] rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] overflow-hidden"
		>
			{#each threads as thread (thread.id)}
				<a
					href={`/notices/${thread.noticeNum}/discussions/${thread.id}`}
					data-testid={`discussion-thread-link-${thread.id}`}
					class="group flex cursor-pointer flex-col justify-between gap-2 p-4 transition-colors hover:bg-[var(--lc-surface-hover)] sm:flex-row sm:items-center no-underline text-inherit"
					on:click={(e) => {
						if (onSelectThread) {
							e.preventDefault();
							onSelectThread(thread.id);
						}
					}}
				>
					<div class="min-w-0 flex-1 space-y-1">
						<div class="flex flex-wrap items-center gap-2">
							{#if thread.status === DiscussionThreadStatus.OPEN}
								<span
									class="lc-chip-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
								>
									<span class="lc-dot-success h-1.5 w-1.5 rounded-full"></span>
									진행 중
								</span>
							{:else}
								<span
									class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
								>
									<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
									닫힘
								</span>
							{/if}
							<h3 class="lc-text-primary truncate text-sm font-semibold group-hover:text-blue-600">
								{thread.title}
							</h3>
						</div>
						<div class="lc-text-muted flex flex-wrap items-center gap-3 text-xs">
							<span class="inline-flex items-center gap-1">
								<FontAwesomeIcon icon={faUser} class="h-2.5 w-2.5" />
								{thread.authorNickname}
								<span class="font-mono text-[11px]">({thread.authorIpMasked})</span>
							</span>
							<span class="inline-flex items-center gap-1">
								<FontAwesomeIcon icon={faClock} class="h-2.5 w-2.5" />
								{formatDateTimeKST(thread.updatedAt)}
							</span>
						</div>
					</div>

					<div class="flex items-center gap-2 self-end sm:self-center">
						<span
							class="lc-chip-blue inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
							title={`의견 ${thread.commentCount}개`}
						>
							<FontAwesomeIcon icon={faComments} class="h-3 w-3" />
							<span>{thread.commentCount}</span>
						</span>
						<FontAwesomeIcon
							icon={faChevronRight}
							class="lc-text-dim hidden h-3 w-3 sm:inline-block transition-transform group-hover:translate-x-0.5"
						/>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
