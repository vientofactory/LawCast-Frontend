<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<header
	class="border-b border-white/20 bg-linear-to-r from-white/95 via-blue-50/80 to-indigo-50/60 shadow-lg shadow-blue-100/30 backdrop-blur-md"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex flex-wrap items-center justify-between gap-4 py-6">
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

			<nav class="order-3 w-full md:order-2 md:w-auto" aria-label="주요 메뉴">
				<ul class="flex flex-wrap items-center gap-2 text-sm font-semibold">
					<li>
						<a
							href="/"
							class="rounded-full border border-blue-100 bg-white/70 px-3 py-1.5 text-blue-700 transition-colors hover:bg-blue-50"
						>
							홈
						</a>
					</li>
					<li>
						<a
							href="/notices"
							class="rounded-full border border-blue-100 bg-white/70 px-3 py-1.5 text-blue-700 transition-colors hover:bg-blue-50"
						>
							입법예고
						</a>
					</li>
					<li>
						<a
							href="/status"
							class="rounded-full border border-blue-100 bg-white/70 px-3 py-1.5 text-blue-700 transition-colors hover:bg-blue-50"
						>
							시스템 상태
						</a>
					</li>
				</ul>
			</nav>

			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class="order-2 flex items-center space-x-2 rounded-lg px-4 py-2 text-gray-600 transition-all md:order-3"
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
