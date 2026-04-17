<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<header
	class="border-b border-white/20 bg-linear-to-r from-white/95 via-blue-50/80 to-indigo-50/60 shadow-lg shadow-blue-100/30 backdrop-blur-md"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between py-8">
			<a
				href="/"
				class="text-decoration-none group flex items-center space-x-4 transition-all duration-300 hover:scale-105"
			>
				<div>
					<h1
						class="bg-linear-to-r from-gray-800 via-blue-700 to-indigo-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent"
					>
						LawCast
					</h1>
					<p class="mt-1 text-sm font-medium text-gray-600">국회 입법예고 스냅샷 아카이브</p>
				</div>
			</a>

			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center space-x-2 rounded-lg px-4 py-2 text-gray-600 transition-all"
			>
				<FontAwesomeIcon icon={faGithub} class="h-6 w-6" />
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
