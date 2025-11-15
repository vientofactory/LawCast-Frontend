<script lang="ts">
	import { Bell, ExternalLink, Plus } from 'lucide-svelte';
	import type { Notice } from '$lib/types/api';
	import { openExternalLink } from '$lib/utils/helpers';

	export let notices: Notice[] = [];
</script>

<div
	class="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-lg shadow-green-100/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-green-100/60"
>
	<div class="mb-6 flex items-center justify-between">
		<h2 class="flex items-center text-xl font-bold tracking-tight text-gray-800">
			<div class="mr-3 rounded-lg bg-linear-to-r from-green-500 to-emerald-500 p-2">
				<Bell class="h-5 w-5 text-white" />
			</div>
			최근 입법예고 ({notices.length})
		</h2>
		{#if notices.length > 0}
			<a
				href="./notices"
				class="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
			>
				전체 보기
				<ExternalLink class="ml-1 h-4 w-4" />
			</a>
		{/if}
	</div>

	{#if notices.length === 0}
		<div class="py-8 text-center">
			<div class="mb-2 text-gray-400">
				<Bell class="mx-auto h-8 w-8" />
			</div>
			<p class="text-gray-500">아직 수집된 입법예고가 없습니다.</p>
			<p class="mt-1 text-sm text-gray-400">서버가 시작되면 자동으로 데이터를 수집합니다.</p>
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
						<button
							on:click={() => openExternalLink(notice.link)}
							class="ml-3 shrink-0 rounded-lg bg-blue-100/80 p-2 text-blue-600 transition-all duration-200 hover:scale-105 hover:bg-blue-200 hover:text-blue-700"
							title="자세히 보기"
						>
							<ExternalLink class="h-4 w-4" />
						</button>
					</div>
					<div class="flex items-center justify-between text-xs text-gray-500">
						<span>{notice.proposerCategory} | {notice.committee}</span>
						<span>의견 {notice.numComments}개</span>
					</div>
					<div class="mt-1 text-xs text-gray-400">
						의안번호: {notice.num}
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
					<Plus class="mr-1 h-4 w-4" />
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
