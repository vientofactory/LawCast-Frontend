<script lang="ts">
	import { DiscussionThreadStatus, type DiscussionThreadWithNotice } from '$lib/types/api';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import {
		faComments,
		faExternalLink,
		faLock,
		faPlus,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	export let threads: DiscussionThreadWithNotice[] = [];
</script>

<section
	class="lc-panel-card rounded-md border p-5 transition-all duration-300"
	aria-label="최근 토론"
>
	<div class="mb-6 flex items-center justify-between">
		<h2 class="lc-text-primary flex items-center text-xl font-bold tracking-tight">
			<div class="lc-icon-accent-success mr-3 rounded-lg p-2">
				<FontAwesomeIcon icon={faComments} class="lc-text-on-accent h-5 w-5" />
			</div>
			최근 토론
		</h2>
		{#if threads.length > 0}
			<a href="/discussions" class="lc-link flex items-center text-sm font-medium">
				전체 토론 보기
				<FontAwesomeIcon icon={faExternalLink} class="ml-1 h-4 w-4" />
			</a>
		{/if}
	</div>

	{#if threads.length === 0}
		<div class="py-8 text-center">
			<div class="lc-text-dim mb-2">
				<FontAwesomeIcon icon={faComments} class="mx-auto h-8 w-8" />
			</div>
			<p class="lc-text-muted">아직 등록된 토론이 없습니다.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each threads.slice(0, 5) as thread, index (thread.id)}
				<article
					aria-labelledby="recent-discussion-{thread.id}"
					class="lc-panel-inset group rounded-md border p-4 transition-all duration-200"
					class:lc-defer-render-sm={index > 1}
				>
					<div class="mb-3 flex items-start justify-between gap-3">
						<a
							id="recent-discussion-{thread.id}"
							href="/notices/{thread.noticeNum}/discussions/{thread.id}"
							class="lc-text-primary line-clamp-2 text-sm leading-relaxed font-semibold no-underline transition-colors duration-150 hover:text-blue-600 hover:underline group-hover:text-blue-600"
						>
							{thread.title}
						</a>
						<span
							class="lc-chip-blue inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
							title={`의견 ${thread.commentCount.toLocaleString('ko-KR')}개`}
						>
							<FontAwesomeIcon icon={faComments} class="h-3 w-3" />
							<span>{thread.commentCount.toLocaleString('ko-KR')}</span>
						</span>
					</div>
					<div class="lc-text-muted flex items-center justify-between text-xs">
						<span
							>{thread.noticeSubject
								? `의안번호 ${thread.noticeNum} · ${thread.noticeSubject}`
								: `의안번호 ${thread.noticeNum}`}</span
						>
					</div>
					<div class="lc-text-dim mt-1 text-xs">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="inline-flex items-center gap-1">
								<FontAwesomeIcon icon={faUser} class="h-2.5 w-2.5" />
								{thread.authorNickname}
							</span>
							<span>· {formatDateTimeKST(thread.updatedAt)}</span>
							{#if thread.status === DiscussionThreadStatus.CLOSED}
								<span
									class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
								>
									<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
									닫힘
								</span>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>

		{#if threads.length > 5}
			<div class="mt-4 text-center">
				<a href="/discussions" class="lc-link inline-flex items-center text-sm">
					<FontAwesomeIcon icon={faPlus} class="mr-1 h-4 w-4" />
					더 보기
				</a>
			</div>
		{/if}
	{/if}
</section>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
