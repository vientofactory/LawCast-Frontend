<script lang="ts">
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { modalFocus } from '#lib/utils/modal-focus.ts';
	import { reducedModalMotion } from '#lib/utils/modal-motion.ts';
	import { page } from '$app/state';
	import { theme } from '#lib/theme.ts';
	import UrgentNoticeBanner from '#lib/components/UrgentNoticeBanner.svelte';
	import BrandLogo from '#lib/components/BrandLogo.svelte';
	import ModalCloseButton from '#lib/components/ModalCloseButton.svelte';
	import { useUrgentNotice } from '#lib/utils/urgent-notice.svelte.ts';
	const urgentNoticeRead = useUrgentNotice();
	import {
		faFileLines,
		faHouse,
		faBars,
		faCodeCompare,
		faComments,
		faMoon,
		faSun,
		faBell,
		faChartBar
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	type HeaderMenuItem = {
		href: string;
		label: string;
		icon: typeof faHouse;
	};

	const menuItems: HeaderMenuItem[] = [
		{ href: '/', label: '홈', icon: faHouse },
		{ href: '/notices', label: '입법예고', icon: faFileLines },
		{ href: '/notices/changes', label: '변경 내역', icon: faCodeCompare },
		{ href: '/discussions', label: '토론', icon: faComments },
		{ href: '/proposals', label: '발의 통계', icon: faChartBar },
		{ href: '/webhook', label: '알림 설정', icon: faBell }
	];

	function isActive(href: string): boolean {
		const currentPath = page.url.pathname.replace(/\/+$/, '') || '/';
		const isNoticeDiscussionPath = /^\/notices\/[^/]+\/discussions(?:\/|$)/.test(currentPath);
		if (href === '/') return currentPath === '/';
		if (href === '/notices/changes') {
			return currentPath === '/notices/changes' || currentPath.startsWith('/notices/changes/');
		}
		if (href === '/discussions') {
			return (
				isNoticeDiscussionPath ||
				currentPath === '/discussions' ||
				currentPath.startsWith('/discussions/')
			);
		}
		if (href === '/notices') {
			return (
				currentPath === '/notices' ||
				(currentPath.startsWith('/notices/') &&
					!isNoticeDiscussionPath &&
					currentPath !== '/notices/changes' &&
					!currentPath.startsWith('/notices/changes/'))
			);
		}
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}

	let mobileMenuOpen = $state(false);
	let headerScrolled = $state(false);
	let menuButton = $state<HTMLButtonElement>();

	onMount(() => {
		const updateHeaderScrollState = () => {
			headerScrolled = window.scrollY > 10;
		};

		updateHeaderScrollState();
		window.addEventListener('scroll', updateHeaderScrollState, { passive: true });
		const resize = new ResizeObserver(() => {
			if (mobileMenuOpen && menuButton && getComputedStyle(menuButton).display === 'none')
				closeMobileMenu();
		});
		if (menuButton?.parentElement) resize.observe(menuButton.parentElement);

		return () => {
			window.removeEventListener('scroll', updateHeaderScrollState);
			resize.disconnect();
		};
	});

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	let isDarkTheme = $derived($theme === 'dark');

	// Layout load exposes ONE urgent notice on every route (GET
	// /api/announcements/top?urgent=true — first `긴급` row in display order),
	// null when no urgent notice exists. The full list stays off global SSR.
	const urgentNotice = $derived(urgentNoticeRead?.data?.item ?? null);

	function trapFocus(node: HTMLElement) {
		const focus = modalFocus(node, { returnFocus: menuButton });
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeMobileMenu();
			}
		};
		node.addEventListener('keydown', escape);
		return {
			destroy() {
				node.removeEventListener('keydown', escape);
				focus.destroy();
			}
		};
	}
</script>

<header
	class={`lc-header-shell border-b ${headerScrolled ? 'is-scrolled' : 'is-at-top'}`}
	data-testid="site-header"
>
	<div class="lc-header-container">
		<div class="lc-header-row">
			<a
				href="/"
				data-testid="site-brand"
				class="text-decoration-none group flex items-center gap-4 transition-transform duration-300 hover:scale-[1.02]"
			>
				<div class="lc-brand-heading" data-testid="brand-heading">
					<BrandLogo animate />
					<p
						class="lc-brand-tagline mt-1 text-sm font-medium text-[var(--lc-text-secondary)]"
						data-testid="brand-tagline"
					>
						국회 입법예고 스냅샷 아카이브
					</p>
				</div>
			</a>

			<div class="lc-header-theme items-center">
				<button
					type="button"
					onclick={() => theme.toggle()}
					class="lc-theme-switch inline-flex cursor-pointer items-center rounded-full transition-[background-color,color] duration-200"
					role="switch"
					aria-checked={isDarkTheme}
					aria-label={isDarkTheme ? '라이트 테마로 전환' : '다크 테마로 전환'}
					title={isDarkTheme ? '라이트 테마' : '다크 테마'}
				>
					<span class={`lc-theme-switch-track ${isDarkTheme ? 'is-dark' : ''}`} aria-hidden="true">
						<span class={`lc-theme-switch-thumb ${isDarkTheme ? 'is-dark' : ''}`}>
							{#if isDarkTheme}
								<FontAwesomeIcon icon={faMoon} class="h-3 w-3" />
							{:else}
								<FontAwesomeIcon icon={faSun} class="h-3 w-3" />
							{/if}
						</span>
					</span>
				</button>
			</div>

			<!-- Hamburger/close button -->
			<button
				bind:this={menuButton}
				class="lc-header-menu-toggle ml-auto inline-flex items-center justify-center rounded-md border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-2 text-[var(--lc-text-secondary)] transition-[background-color,color] duration-200 hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-primary)]"
				aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
				onclick={toggleMobileMenu}
				aria-expanded={mobileMenuOpen}
				aria-controls="mobile-menu-panel"
			>
				<FontAwesomeIcon
					icon={faBars}
					class={`h-6 w-6 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-90 opacity-60' : ''}`}
				/>
				<span class="sr-only">{mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}</span>
			</button>

			<!-- Desktop menu -->
			<nav class="lc-desktop-navigation" aria-label="주요 메뉴" data-testid="primary-navigation">
				<ul class="flex flex-nowrap items-center justify-center gap-1 text-sm font-semibold">
					{#each menuItems as item (item.href)}
						<li>
							<a
								href={item.href}
								aria-current={isActive(item.href) ? 'page' : undefined}
								data-testid={`nav-link-${item.href === '/' ? 'home' : item.href.replace(/^\//, '').replace(/[/]+/g, '-')}`}
								data-nav-target={item.href}
								title={item.label}
								aria-label={item.label}
								class={`lc-nav-link group/menu inline-flex items-center gap-2 rounded-md px-2.5 py-2.5 whitespace-nowrap transition-[background-color,color] duration-200 lg:px-3 lg:py-3 ${
									isActive(item.href)
										? 'border border-[var(--lc-border-strong)] bg-[var(--lc-surface-accent)] text-[var(--lc-text-primary)]'
										: 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-accent)]'
								}`}
								style="min-height:44px"
							>
								<span
									class={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${isActive(item.href) ? 'bg-[var(--lc-surface-primary)] text-[var(--lc-text-accent)]' : 'bg-[var(--lc-surface-muted)] text-[var(--lc-text-accent)] group-hover/menu:bg-[var(--lc-surface-accent)]'}`}
								>
									<FontAwesomeIcon icon={item.icon} class="h-3.5 w-3.5" />
								</span>
								<span class="lc-desktop-nav-label">{item.label}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
</header>

{#if urgentNotice}
	<UrgentNoticeBanner notice={urgentNotice} />
{/if}

<!-- Mobile dropdown menu -->
{#if mobileMenuOpen}
	<div class="lc-mobile-menu-overlay fixed inset-0 z-1100 flex flex-col">
		<!-- Overlay -->
		<button
			type="button"
			class="lc-overlay-backdrop absolute inset-0 cursor-default backdrop-blur-[2px]"
			aria-label="메뉴 닫기"
			tabindex="-1"
			onclick={closeMobileMenu}
		></button>
		<!-- Menu panel -->
		<nav
			id="mobile-menu-panel"
			use:trapFocus
			class="lc-mobile-menu-panel relative z-10 w-full rounded-b-md border-b border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-4 pt-6"
			aria-label="모바일 메뉴"
			data-testid="mobile-navigation"
			transition:fly={{ y: -16, duration: reducedModalMotion() ? 0 : 180, opacity: 0 }}
		>
			<div class="mb-4 flex items-center justify-between">
				<ModalCloseButton label="메뉴 닫기" testId="mobile-menu-close" onclick={closeMobileMenu} />
				<button
					type="button"
					onclick={() => theme.toggle()}
					class="lc-theme-switch inline-flex cursor-pointer items-center rounded-full border p-1 transition-[background-color,color] duration-200"
					role="switch"
					aria-checked={isDarkTheme}
					aria-label={isDarkTheme ? '라이트 테마로 전환' : '다크 테마로 전환'}
				>
					<span class={`lc-theme-switch-track ${isDarkTheme ? 'is-dark' : ''}`} aria-hidden="true">
						<span class={`lc-theme-switch-thumb ${isDarkTheme ? 'is-dark' : ''}`}>
							{#if isDarkTheme}
								<FontAwesomeIcon icon={faMoon} class="h-3 w-3" />
							{:else}
								<FontAwesomeIcon icon={faSun} class="h-3 w-3" />
							{/if}
						</span>
					</span>
				</button>
			</div>
			<ul class="flex flex-col gap-2 text-base font-semibold">
				{#each menuItems as item (item.href)}
					<li>
						<a
							href={item.href}
							aria-current={isActive(item.href) ? 'page' : undefined}
							data-testid={`mobile-nav-link-${item.href === '/' ? 'home' : item.href.replace(/^\//, '').replace(/[/]+/g, '-')}`}
							data-nav-target={item.href}
							class={`lc-nav-link group/menu inline-flex items-center gap-2 rounded-xl px-3 py-3 transition-[background-color,color] duration-200 ${
								isActive(item.href)
									? 'border border-[var(--lc-border-strong)] bg-[var(--lc-surface-accent)] text-[var(--lc-text-primary)] shadow-sm'
									: 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-accent)]'
							}`}
							style="min-height:44px"
							onclick={closeMobileMenu}
						>
							<span
								class={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${isActive(item.href) ? 'bg-[var(--lc-surface-primary)] text-[var(--lc-text-accent)]' : 'bg-[var(--lc-surface-muted)] text-[var(--lc-text-accent)] group-hover/menu:bg-[var(--lc-surface-accent)]'}`}
							>
								<FontAwesomeIcon icon={item.icon} class="h-3.5 w-3.5" />
							</span>
							<span>{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
{/if}

<style>
	@media (prefers-reduced-motion: no-preference) {
		.lc-brand-heading:has(:global([data-intro='true'])) .lc-brand-tagline {
			animation: lc-reveal-tagline 450ms cubic-bezier(0.22, 1, 0.36, 1) 1700ms both;
		}
	}

	@keyframes lc-reveal-tagline {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	a {
		text-decoration: none;
		color: inherit;
	}
	a:hover {
		color: inherit;
	}

	.lc-header-shell {
		position: sticky;
		top: 0;
		z-index: 1000;
		background: var(--lc-header-gradient);
		border-color: var(--lc-border-soft);
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		transition:
			background-color 180ms ease,
			border-color 180ms ease,
			box-shadow 200ms ease,
			backdrop-filter 200ms ease;
	}

	.lc-header-shell.is-at-top {
		box-shadow: none;
	}

	.lc-header-shell.is-scrolled {
		background: var(--lc-header-gradient);
		border-color: color-mix(in srgb, var(--lc-border-soft) 74%, var(--lc-border-strong) 26%);
		box-shadow: none;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}
</style>
