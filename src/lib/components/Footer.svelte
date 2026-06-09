<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<footer class="mt-auto border-t border-slate-200/70 bg-white/80 py-6">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
			<div class="flex flex-col gap-1">
				<p class="text-sm text-slate-500">
					🄯 Copyleft {new Date().getFullYear()} LawCast
				</p>
				<p class="text-sm text-slate-500">
					LawCast는 대한민국 국회와 관련이 없습니다. 모든 법률안은 기본적으로 퍼블릭 도메인으로
					취급됩니다.
				</p>
				<p class="text-sm text-slate-500">
					Powered by <a
						href="https://github.com/vientorepublic"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sky-500 hover:text-sky-600">Vientorepublic</a
					>.
				</p>
				<p class="text-sm text-slate-500">
					<a href="/license" class="text-sky-500 hover:text-sky-600">오픈소스 라이선스</a>
				</p>
			</div>
			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:text-slate-700"
				aria-label="GitHub 저장소 열기"
			>
				<FontAwesomeIcon icon={faGithub} class="h-5 w-5" />
			</a>
		</div>
	</div>
</footer>
