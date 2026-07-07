<script lang="ts">
	import type { Notice, SystemStats } from '$lib/types/api';
	import { openExternalLink, downloadFile, isDownloadable, formatDate } from '$lib/utils/helpers';
	import {
		faBell,
		faExternalLink,
		faFileDownload,
		faFileText,
		faLock,
		faPlus,
		faRobot,
		faRotate,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	export let notices: Notice[] = [];
	export let stats: SystemStats | undefined = undefined;
	$: aiSummaryEnabled = stats?.aiSummaryEnabled !== false;

	function isSourceDeleted(notice: Notice): boolean {
		return notice.lifecycleStatus === 'source_deleted';
	}

	function isRenumbered(notice: Notice): boolean {
		return notice.lifecycleStatus === 'renumbered';
	}
</script>

<section
	class="lc-panel-card rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl"
	aria-label="최근 입법예고"
>
	<div class="mb-6 flex items-center justify-between">
		<h2 class="lc-text-primary flex items-center text-xl font-bold tracking-tight">
			<div class="lc-icon-accent-success mr-3 rounded-lg p-2">
				<FontAwesomeIcon icon={faBell} class="lc-text-on-accent h-5 w-5" />
			</div>
			최근 입법예고
		</h2>
		{#if notices.length > 0}
			<a href="./notices" class="lc-link flex items-center text-sm font-medium">
				전체 입법예고 보기
				<FontAwesomeIcon icon={faExternalLink} class="ml-1 h-4 w-4" />
			</a>
		{/if}
	</div>

	{#if notices.length > 0 && aiSummaryEnabled}
		<a
			href="./notices"
			class="lc-ai-panel group/ai mb-4 block rounded-xl border p-3 shadow-sm transition-all duration-200 hover:shadow-md"
		>
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="lc-ai-title inline-flex items-center text-xs font-bold tracking-wide">
						<FontAwesomeIcon icon={faRobot} class="mr-1.5 h-3.5 w-3.5" />
						AI 에이전트 브리핑
					</p>
					<p class="lc-text-secondary mt-1 text-sm font-medium">
						전체 입법예고 페이지에서 각 법률안의 AI 요약을 확인할 수 있습니다!
					</p>
				</div>
				<span
					class="lc-ai-badge lc-ai-badge-hoverable inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
				>
					보러가기
					<FontAwesomeIcon icon={faExternalLink} class="ml-1.5 h-3 w-3" />
				</span>
			</div>
		</a>
	{/if}

	{#if notices.length === 0}
		<div class="py-8 text-center">
			<div class="lc-text-dim mb-2">
				<FontAwesomeIcon icon={faBell} class="mx-auto h-8 w-8" />
			</div>
			<p class="lc-text-muted">아직 수집된 입법예고가 없습니다.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each notices.slice(0, 5) as notice, index (notice.num)}
				<article
					aria-labelledby="recent-notice-{notice.num}"
					class="lc-panel-inset group rounded-xl border p-4 transition-all duration-200 hover:shadow-md"
					class:lc-defer-render-sm={index > 1}
				>
					<div class="mb-3 flex items-start justify-between">
						<a
							id="recent-notice-{notice.num}"
							href="/notices/{notice.num}"
							class="lc-text-primary line-clamp-2 text-sm leading-relaxed font-semibold no-underline transition-colors duration-150"
						>
							{notice.subject}
						</a>
						<div class="ml-3 flex shrink-0 items-center gap-1">
							<!-- 파일 다운로드 버튼들 -->
							{#if notice.attachments && (isDownloadable(notice.attachments.pdfFile) || isDownloadable(notice.attachments.hwpFile))}
								<div class="flex gap-1">
									{#if isDownloadable(notice.attachments.pdfFile)}
										<button
											on:click={() => downloadFile(notice.attachments.pdfFile, `${notice.num}.pdf`)}
											aria-label="PDF 다운로드"
											class="lc-action-chip-red cursor-pointer rounded-md p-1.5 transition-colors"
										>
											<FontAwesomeIcon icon={faFileText} class="h-3.5 w-3.5" />
										</button>
									{/if}
									{#if isDownloadable(notice.attachments.hwpFile)}
										<button
											on:click={() => downloadFile(notice.attachments.hwpFile, `${notice.num}.hwp`)}
											aria-label="HWP 다운로드"
											class="lc-action-chip-blue cursor-pointer rounded-md p-1.5 transition-colors"
										>
											<FontAwesomeIcon icon={faFileDownload} class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
								<div class="lc-divider-soft h-4 w-px"></div>
							{/if}
							<!-- 상세보기 버튼 -->
							<button
								on:click={() => openExternalLink(notice.link)}
								aria-label="온라인 원문 보기 (새 탭)"
								class="lc-button-neutral cursor-pointer rounded-md p-1.5 transition-colors"
							>
								<FontAwesomeIcon icon={faExternalLink} class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
					<div class="lc-text-muted flex items-center justify-between text-xs">
						<span>{notice.proposerCategory}{notice.committee ? ` | ${notice.committee}` : ''}</span>
					</div>
					<div class="lc-text-dim mt-1 text-xs">
						<div class="flex flex-wrap items-center gap-1.5">
							<span>의안번호: {notice.num}</span>
							{#if notice.isDone}
								<span
									class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
								>
									<FontAwesomeIcon icon={faLock} class="h-2.5 w-2.5" />
									종료
								</span>
							{/if}
							{#if isSourceDeleted(notice)}
								<span
									class="lc-chip-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
								>
									<FontAwesomeIcon icon={faTriangleExclamation} class="h-2.5 w-2.5" />
									보존
								</span>
							{:else if isRenumbered(notice)}
								<span
									class="lc-chip-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
								>
									<FontAwesomeIcon icon={faRotate} class="h-2.5 w-2.5" />
									번호변경
								</span>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>

		{#if notices.length > 5}
			<div class="mt-4 text-center">
				<a href="./notices" class="lc-link inline-flex items-center text-sm">
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
