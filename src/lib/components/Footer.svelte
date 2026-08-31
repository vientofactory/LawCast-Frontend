<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<footer
	class="mt-auto border-t border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] py-6 backdrop-blur-sm"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex flex-col gap-3">
				<p class="lc-text-secondary text-center text-sm sm:text-left">
					LawCast는 대한민국 국회와 관련이 없습니다. 모든 법률안은 기본적으로 퍼블릭 도메인으로
					취급됩니다.
				</p>
				<div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
					<p class="lc-text-secondary text-sm">
						Powered by <a
							href="https://github.com/vientorepublic"
							target="_blank"
							rel="noopener noreferrer"
							class="lc-link">Vientorepublic</a
						>
					</p>
					<p class="lc-text-secondary text-sm">
						<a href="/license" class="lc-link">오픈소스 라이선스</a>
					</p>
					<p class="lc-text-secondary text-sm">
						<a href="/status" class="lc-link">시스템 상태</a>
					</p>
					<p class="lc-text-secondary text-sm">
						<a href="/crawling-transparency" class="lc-link">투명성 정보</a>
					</p>
					<p class="lc-text-secondary text-sm">
						<a href="/proposals" class="lc-link">발의 통계</a>
					</p>
					{#if env.PUBLIC_DISCORD_SERVER_URL?.trim()}
						<p class="lc-text-secondary text-sm">
							<a
								href={env.PUBLIC_DISCORD_SERVER_URL}
								target="_blank"
								rel="noopener noreferrer"
								class="lc-link">디스코드 서버</a
							>
						</p>
					{/if}
				</div>
			</div>
			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class="lc-text-muted self-center rounded-lg p-2 transition-colors duration-200 hover:text-[var(--lc-text-primary)] sm:self-start"
				aria-label="GitHub 저장소 열기"
			>
				<FontAwesomeIcon icon={faGithub} class="h-5 w-5" />
			</a>
		</div>
	</div>
</footer>
