<script lang="ts">
	import { Bell, Github } from 'lucide-svelte';
</script>

<div
	class="rounded-2xl border border-blue-200/40 bg-linear-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/40 p-6 shadow-lg shadow-blue-100/30 backdrop-blur-sm"
>
	<h3 class="mb-4 flex items-center text-lg font-bold text-blue-900">
		<div class="mr-2 rounded-lg bg-blue-200/50 p-1.5">
			<Bell class="h-4 w-4 text-blue-700" />
		</div>
		서비스 안내
	</h3>
	<ul class="space-y-3 text-sm text-blue-800">
		<li class="flex items-start">
			<span class="mt-0.5 mr-3 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
			10분마다 자동으로 새로운 입법예고를 확인합니다
		</li>
		<li class="flex items-start">
			<span class="mt-0.5 mr-3 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
			새로운 입법예고 발견 시 Discord 웹훅으로 알림을 전송합니다
		</li>
		<li class="flex items-start">
			<span class="mt-0.5 mr-3 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
			로그인 없이 간단하게 Discord 웹훅 URL만 등록하면 됩니다
		</li>
		<li class="flex items-start">
			<span class="mt-0.5 mr-3 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center space-x-2 text-blue-800 hover:text-blue-600 transition-colors"
			>
				<Github class="h-4 w-4" />
				<span>오픈소스 프로젝트</span>
			</a>
		</li>
	</ul>
</div>
