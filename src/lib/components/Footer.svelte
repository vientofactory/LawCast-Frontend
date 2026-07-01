<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<footer
	class="mt-auto border-t border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] py-6 backdrop-blur-sm"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
			<div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
				<p class="lc-text-secondary text-sm">
					LawCast는 대한민국 국회와 관련이 없습니다. 모든 법률안은 기본적으로 퍼블릭 도메인으로
					취급됩니다.
				</p>
				<div class="hidden h-4 w-px bg-[var(--lc-border-soft)] sm:block"></div>
				<p class="lc-text-secondary text-sm">
					Powered by <a
						href="https://github.com/vientorepublic"
						target="_blank"
						rel="noopener noreferrer"
						class="lc-link">Vientorepublic</a
					>
				</p>
				<div class="hidden h-4 w-px bg-[var(--lc-border-soft)] sm:block"></div>
				<p class="lc-text-secondary text-sm">
					<a href="/license" class="lc-link">오픈소스 라이선스</a>
				</p>
				<div class="hidden h-4 w-px bg-[var(--lc-border-soft)] sm:block"></div>
				<p class="lc-text-secondary text-sm">
					<a href="/status" class="lc-link">시스템 상태</a>
				</p>
			</div>
			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class="lc-text-muted rounded-lg p-2 transition-colors duration-200 hover:text-[var(--lc-text-primary)]"
				aria-label="GitHub 저장소 열기"
			>
				<FontAwesomeIcon icon={faGithub} class="h-5 w-5" />
			</a>
		</div>
	</div>
</footer>
