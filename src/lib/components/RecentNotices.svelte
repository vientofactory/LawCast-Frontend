<script lang="ts">
	import type { Notice, SystemStats } from '$lib/types/api';
	import { openExternalLink, downloadFile, isDownloadable, formatDate } from '$lib/utils/helpers';
	import {
		faBell,
		faExternalLink,
		faFileDownload,
		faFileText,
		faPlus,
		faClock,
		faDatabase,
		faRobot
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	export let notices: Notice[] = [];
	export let stats: SystemStats | undefined = undefined;
</script>

<div
	class="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-lg shadow-green-100/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-green-100/60"
>
	<div class="mb-6 flex items-center justify-between">
		<h2 class="flex items-center text-xl font-bold tracking-tight text-gray-800">
			<div class="mr-3 rounded-lg bg-linear-to-r from-green-500 to-emerald-500 p-2">
				<FontAwesomeIcon icon={faBell} class="h-5 w-5 text-white" />
			</div>
			최근 입법예고 ({notices.length})
		</h2>
		{#if notices.length > 0}
			<a
				href="./notices"
				class="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
			>
				전체 보기
				<FontAwesomeIcon icon={faExternalLink} class="ml-1 h-4 w-4" />
			</a>
		{/if}
	</div>

	{#if stats}
		<div
			class="mb-4 flex flex-wrap gap-4 rounded-lg bg-gray-50/50 text-xs font-medium text-gray-500"
		>
			<div class="flex items-center">
				<FontAwesomeIcon icon={faDatabase} class="mr-1.5 h-3 w-3 text-green-600" />
				<span>수집된 입법예고: <span class="text-gray-700">{stats.cache.size}개</span></span>
			</div>
			<div class="flex items-center">
				<FontAwesomeIcon icon={faClock} class="mr-1.5 h-3 w-3 text-blue-600" />
				<span
					>마지막 업데이트: <span class="text-gray-700"
						>{stats.cache.lastUpdated ? formatDate(stats.cache.lastUpdated) : 'N/A'}</span
					></span
				>
			</div>
		</div>
	{/if}

	{#if notices.length > 0}
		<a
			href="./notices"
			class="group/ai mb-4 block rounded-xl border border-cyan-200/70 bg-linear-to-r from-cyan-50 via-sky-50 to-indigo-50 p-3 shadow-sm transition-all duration-200 hover:shadow-md"
		>
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="inline-flex items-center text-xs font-bold tracking-wide text-cyan-700">
						<FontAwesomeIcon icon={faRobot} class="mr-1.5 h-3.5 w-3.5" />
						AI 에이전트 브리핑
					</p>
					<p class="mt-1 text-sm font-medium text-slate-700">
						전체 입법예고 페이지에서 각 법률안의 AI 요약을 확인할 수 있습니다!
					</p>
				</div>
				<span
					class="inline-flex shrink-0 items-center rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition-colors group-hover/ai:bg-cyan-200"
				>
					보러가기
					<FontAwesomeIcon icon={faExternalLink} class="ml-1.5 h-3 w-3" />
				</span>
			</div>
		</a>
	{/if}

	{#if notices.length === 0}
		<div class="py-8 text-center">
			<div class="mb-2 text-gray-400">
				<FontAwesomeIcon icon={faBell} class="mx-auto h-8 w-8" />
			</div>
			<p class="text-gray-500">아직 수집된 입법예고가 없습니다.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each notices.slice(0, 5) as notice (notice.num)}
				<div
					class="group rounded-xl border border-gray-100 bg-linear-to-r from-gray-50/50 to-blue-50/30 p-4 transition-all duration-200 hover:from-blue-50/60 hover:to-indigo-50/40 hover:shadow-md"
				>
					<div class="mb-3 flex items-start justify-between">
						<h3
							class="line-clamp-2 text-sm leading-relaxed font-semibold text-gray-800 group-hover:text-gray-900"
						>
							{notice.subject}
						</h3>
						<div class="ml-3 flex shrink-0 items-center gap-1">
							<!-- 파일 다운로드 버튼들 -->
							{#if notice.attachments && (isDownloadable(notice.attachments.pdfFile) || isDownloadable(notice.attachments.hwpFile))}
								<div class="flex gap-1">
									{#if isDownloadable(notice.attachments.pdfFile)}
										<button
											on:click={() => downloadFile(notice.attachments.pdfFile, `${notice.num}.pdf`)}
											class="cursor-pointer rounded-md bg-red-50/90 p-1.5 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
											title="PDF 다운로드"
										>
											<FontAwesomeIcon icon={faFileText} class="h-3.5 w-3.5" />
										</button>
									{/if}
									{#if isDownloadable(notice.attachments.hwpFile)}
										<button
											on:click={() => downloadFile(notice.attachments.hwpFile, `${notice.num}.hwp`)}
											class="cursor-pointer rounded-md bg-blue-50/90 p-1.5 text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
											title="HWP 다운로드"
										>
											<FontAwesomeIcon icon={faFileDownload} class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
								<div class="h-4 w-px bg-gray-200"></div>
							{/if}
							<!-- 상세보기 버튼 -->
							<button
								on:click={() => openExternalLink(notice.link)}
								class="cursor-pointer rounded-md bg-gray-50/90 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700"
								title="자세히 보기"
							>
								<FontAwesomeIcon icon={faExternalLink} class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
					<div class="flex items-center justify-between text-xs text-gray-500">
						<span>{notice.proposerCategory} | {notice.committee}</span>
						<span>의견 {notice.numComments.toLocaleString()}개</span>
					</div>
					<div class="mt-1 text-xs text-gray-400">
						<span>의안번호: {notice.num}</span>
					</div>
				</div>
			{/each}
		</div>

		{#if notices.length > 5}
			<div class="mt-4 text-center">
				<a
					href="./notices"
					class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
				>
					<FontAwesomeIcon icon={faPlus} class="mr-1 h-4 w-4" />
					{notices.length - 5}개 더 보기
				</a>
			</div>
		{/if}
	{/if}
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
