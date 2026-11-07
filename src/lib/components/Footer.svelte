<script lang="ts">
	import * as env from '$app/env/public';
	import BrandLogo from '#lib/components/BrandLogo.svelte';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import { faGithub, faInstagram, faXTwitter } from '@fortawesome/free-brands-svg-icons';

	type LogoGradient = {
		direction: { x1: string; y1: string; x2: string; y2: string };
		stops: readonly { offset: string; color: string }[];
	};

	type SocialProfile = {
		id: string;
		href: string;
		label: string;
		icon: IconDefinition;
		brandPaint?: string | LogoGradient;
	};

	const instagramLogoGradient: LogoGradient = {
		direction: { x1: '12%', y1: '100%', x2: '86%', y2: '0%' },
		stops: [
			{ offset: '0%', color: '#feda75' },
			{ offset: '30%', color: '#fa7e1e' },
			{ offset: '55%', color: '#d62976' },
			{ offset: '78%', color: '#962fbf' },
			{ offset: '100%', color: '#4f5bd5' }
		]
	};

	const socialProfiles: readonly SocialProfile[] = [
		{
			id: 'instagram',
			href: 'https://www.instagram.com/lawcast.official',
			label: 'LawCast 인스타그램 (새 탭에서 열기)',
			icon: faInstagram,
			brandPaint: instagramLogoGradient
		},
		{
			id: 'x',
			href: 'https://x.com/real_lawcast',
			label: 'LawCast X (새 탭에서 열기)',
			icon: faXTwitter
		},
		{
			id: 'github',
			href: 'https://github.com/vientofactory/lawcast',
			label: 'GitHub 저장소 열기',
			icon: faGithub
		}
	];

	let {
		frontendVersion = 'unknown',
		backendVersion = 'unknown'
	}: { frontendVersion?: string; backendVersion?: string } = $props();

	const profileLinkClass =
		'group inline-flex size-11 items-center justify-center rounded-lg text-(--lc-text-secondary) motion-safe:transition-colors hover:bg-(--lc-surface-hover) focus-visible:bg-(--lc-surface-hover) focus-visible:outline-2 focus-visible:outline-(--lc-text-accent)';
	const monochromeProfileClass =
		'hover:text-black focus-visible:text-black dark:hover:text-white dark:focus-visible:text-white';
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
			{#each socialProfiles as profile (profile.id)}
				{@const [width, height, , , paths] = profile.icon.icon}
				{@const gradient = typeof profile.brandPaint === 'object' ? profile.brandPaint : undefined}
				{@const gradientId = `footer-${profile.id}-gradient`}
				{@const activeFill = gradient
					? `url(#${gradientId})`
					: typeof profile.brandPaint === 'string'
						? profile.brandPaint
						: 'currentColor'}
				<a
					href={profile.href}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={profile.label}
					data-testid={`footer-${profile.id}`}
					class={[profileLinkClass, !profile.brandPaint && monochromeProfileClass]}
					style:--lc-footer-brand-fill={activeFill}
				>
					<svg
						aria-hidden="true"
						class="size-6 fill-current group-hover:fill-(--lc-footer-brand-fill) group-focus-visible:fill-(--lc-footer-brand-fill)"
						viewBox={`0 0 ${width} ${height}`}
					>
						{#if gradient}
							<defs>
								<linearGradient id={gradientId} {...gradient.direction}>
									{#each gradient.stops as stop (stop.offset)}
										<stop offset={stop.offset} stop-color={stop.color} />
									{/each}
								</linearGradient>
							</defs>
						{/if}
						{#each Array.isArray(paths) ? paths : [paths] as path, index (index)}
							<path d={path} />
						{/each}
					</svg>
				</a>
			{/each}
		</nav>
	</div>
</footer>
