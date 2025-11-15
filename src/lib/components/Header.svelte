<script lang="ts">
	import { Bell } from 'lucide-svelte';
</script>

<header
	class="border-b border-white/20 bg-gradient-to-r from-white/95 via-blue-50/80 to-indigo-50/60 shadow-lg shadow-blue-100/30 backdrop-blur-md"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between py-8">
			<a
				href="/"
				class="text-decoration-none group flex items-center space-x-4 transition-all duration-300 hover:scale-105"
			>
				<div
					class="rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-3 shadow-lg shadow-blue-200/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-blue-300/60"
				>
					<Bell class="h-10 w-10 text-white" />
				</div>
				<div>
					<h1
						class="bg-gradient-to-r from-gray-800 via-blue-700 to-indigo-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent"
					>
						LawCast
					</h1>
					<p class="mt-1 text-sm font-medium text-gray-600">국회 입법예고 디스코드 알리미</p>
				</div>
			</a>
		</div>
	</div>
</header>

<style>
	a {
		text-decoration: none;
		color: inherit;
	}

	a:hover {
		color: inherit;
	}
</style>
