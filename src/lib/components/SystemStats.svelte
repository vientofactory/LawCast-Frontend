<script lang="ts">
	import type { SystemStats } from '$lib/types/api';
	import { formatDate } from '$lib/utils/helpers';

	export let stats: SystemStats;
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
	<div
		class="rounded-2xl border border-blue-200/30 bg-linear-to-br from-blue-50 to-indigo-100/60 p-6 shadow-lg shadow-blue-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200/60"
	>
		<h3 class="mb-2 text-sm font-semibold text-blue-700">등록된 웹훅</h3>
		<p class="mb-1 text-3xl font-bold text-blue-600">
			{stats.webhooks.active.toLocaleString()}
		</p>
		<p class="text-xs text-blue-500/80">
			활성 / 총 {stats.webhooks.total.toLocaleString()}개
		</p>
	</div>
	<div
		class="rounded-2xl border border-green-200/30 bg-linear-to-br from-green-50 to-emerald-100/60 p-6 shadow-lg shadow-green-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-200/60"
	>
		<h3 class="mb-2 text-sm font-semibold text-green-700">캐시된 입법예고</h3>
		<p class="mb-1 text-3xl font-bold text-green-600">{stats.cache.size}</p>
		<p class="text-xs text-green-500/80">최대 {stats.cache.maxSize}개</p>
	</div>
	<div
		class="rounded-2xl border border-purple-200/30 bg-linear-to-br from-purple-50 to-pink-100/60 p-6 shadow-lg shadow-purple-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-200/60"
	>
		<h3 class="mb-2 text-sm font-semibold text-purple-700">마지막 업데이트</h3>
		<p class="text-lg font-bold text-purple-600">
			{stats.cache.lastUpdated ? formatDate(stats.cache.lastUpdated) : '없음'}
		</p>
	</div>
</div>
