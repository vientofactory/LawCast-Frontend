<script lang="ts">
	import * as env from '$app/env/public';
	import BrandLogo from '#lib/components/BrandLogo.svelte';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import {
		height as instagramHeight,
		svgPathData as instagramPath,
		width as instagramWidth
	} from '@fortawesome/free-brands-svg-icons/faInstagram';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	let {
		frontendVersion = 'unknown',
		backendVersion = 'unknown'
	}: { frontendVersion?: string; backendVersion?: string } = $props();

	const profileLinkClass =
		'inline-flex size-11 items-center justify-center rounded-lg text-(--lc-text-secondary) motion-safe:transition-colors hover:bg-(--lc-surface-hover) focus-visible:bg-(--lc-surface-hover) focus-visible:outline-2 focus-visible:outline-(--lc-text-accent)';
</script>

<footer
	class="mt-auto border-t border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] py-6 backdrop-blur-sm"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex flex-col gap-3">
			<a href="/" class="self-center sm:self-start" data-testid="footer-brand">
				<BrandLogo compact />
			</a>
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
				<p class="lc-text-secondary text-sm">
					<a href="/announcements" class="lc-link">공지사항</a>
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
				<p class="lc-text-muted text-sm">
					v{frontendVersion} / API v{backendVersion}
				</p>
			</div>
		</div>
		<nav
			aria-label="SNS 프로필"
			data-testid="footer-social-profiles"
			class="mt-4 flex items-center justify-center gap-2 border-t border-[var(--lc-border-soft)] pt-3 sm:justify-start"
		>
			<a
				href="https://www.instagram.com/lawcast.official"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="LawCast 인스타그램 (새 탭에서 열기)"
				data-testid="footer-instagram"
				class={[profileLinkClass, 'group']}
			>
				<svg aria-hidden="true" class="size-6" viewBox={`0 0 ${instagramWidth} ${instagramHeight}`}>
					<defs>
						<linearGradient id="footer-instagram-gradient" x1="12%" y1="100%" x2="86%" y2="0%">
							<stop offset="0%" stop-color="#feda75" />
							<stop offset="30%" stop-color="#fa7e1e" />
							<stop offset="55%" stop-color="#d62976" />
							<stop offset="78%" stop-color="#962fbf" />
							<stop offset="100%" stop-color="#4f5bd5" />
						</linearGradient>
					</defs>
					<path
						d={instagramPath}
						class="fill-current group-hover:fill-[url(#footer-instagram-gradient)] group-focus-visible:fill-[url(#footer-instagram-gradient)]"
					/>
				</svg>
			</a>
			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class={[
					profileLinkClass,
					'hover:text-black focus-visible:text-black dark:hover:text-white dark:focus-visible:text-white'
				]}
				aria-label="GitHub 저장소 열기"
				data-testid="footer-github"
			>
				<FontAwesomeIcon icon={faGithub} class="w-6 text-2xl" />
			</a>
		</nav>
	</div>
</footer>
