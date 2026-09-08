<script lang="ts">
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { theme } from '$lib/theme';
	import {
		faFileLines,
		faHouse,
		faBars,
		faCodeCompare,
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
		{ href: '/proposals', label: '발의 통계', icon: faChartBar },
		{ href: '/webhook', label: '알림 설정', icon: faBell }
	];

	function isActive(href: string): boolean {
		const currentPath = page.url.pathname.replace(/\/+$/, '') || '/';
		if (href === '/') return currentPath === '/';
		if (href === '/notices/changes') {
			return currentPath === '/notices/changes' || currentPath.startsWith('/notices/changes/');
		}
		if (href === '/notices') {
			return (
				currentPath === '/notices' ||
				(currentPath.startsWith('/notices/') &&
					currentPath !== '/notices/changes' &&
					!currentPath.startsWith('/notices/changes/'))
			);
		}
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}

	let mobileMenuOpen = false;
	let headerScrolled = false;
	let menuButton: HTMLButtonElement;

	onMount(() => {
		const updateHeaderScrollState = () => {
			headerScrolled = window.scrollY > 10;
		};

		updateHeaderScrollState();
		window.addEventListener('scroll', updateHeaderScrollState, { passive: true });

		return () => {
			window.removeEventListener('scroll', updateHeaderScrollState);
		};
	});

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
	function closeMobileMenu() {
		mobileMenuOpen = false;
		menuButton?.focus();
	}

	$: isDarkTheme = $theme === 'dark';

	function trapFocus(node: HTMLElement) {
		const focusableSelectors = [
			'a[href]:not([tabindex="-1"])',
			'button:not([disabled]):not([tabindex="-1"])',
			'[tabindex]:not([tabindex="-1"])'
		].join(', ');

		function handleKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				closeMobileMenu();
				return;
			}
			if (event.key !== 'Tab') return;
			const focusables = Array.from(node.querySelectorAll<HTMLElement>(focusableSelectors));
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			if (event.shiftKey) {
				if (document.activeElement === first) {
					event.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
		}

		node.addEventListener('keydown', handleKeydown);
		const firstFocusable = node.querySelector<HTMLElement>(focusableSelectors);
		firstFocusable?.focus();

		return {
			destroy() {
				node.removeEventListener('keydown', handleKeydown);
			}
		};
	}
</script>

<header
	class={`lc-header-shell border-b ${headerScrolled ? 'is-scrolled' : 'is-at-top'}`}
	data-testid="site-header"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="relative flex flex-wrap items-center gap-4 py-5 md:flex-nowrap md:gap-6">
			<a
				href="/"
				data-testid="site-brand"
				class="text-decoration-none group flex items-center gap-4 transition-all duration-300 hover:scale-[1.02]"
			>
				<div>
					<span class="lc-brand-wordmark text-3xl font-bold tracking-tight"> LawCast </span>
					<p class="mt-1 text-sm font-medium text-[var(--lc-text-secondary)]">
						국회 입법예고 스냅샷 아카이브
					</p>
				</div>
			</a>

			<div class="hidden items-center md:ml-auto md:flex">
				<button
					type="button"
					on:click={() => theme.toggle()}
					class="lc-theme-switch inline-flex cursor-pointer items-center rounded-full transition-all duration-200"
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

			<!-- 햄버거/닫기 버튼 -->
			<button
				bind:this={menuButton}
				class="ml-auto inline-flex items-center justify-center rounded-md border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] px-3 py-2 text-[var(--lc-text-secondary)] transition-all duration-200 hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-primary)] md:hidden"
				aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
				on:click={toggleMobileMenu}
				aria-expanded={mobileMenuOpen}
				aria-controls="mobile-menu-panel"
			>
				<FontAwesomeIcon
					icon={faBars}
					class={`h-6 w-6 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-90 opacity-60' : ''}`}
				/>
				<span class="sr-only">{mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}</span>
			</button>

			<!-- 데스크톱 메뉴 -->
			<nav
				class="hidden w-full rounded-md border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-2 md:absolute md:top-1/2 md:left-1/2 md:block md:w-auto md:-translate-x-1/2 md:-translate-y-1/2"
				aria-label="주요 메뉴"
				data-testid="primary-navigation"
			>
				<ul class="flex flex-wrap items-center justify-center gap-1.5 text-sm font-semibold">
					{#each menuItems as item (item.href)}
						<li>
							<a
								href={item.href}
								aria-current={isActive(item.href) ? 'page' : undefined}
								data-testid={`nav-link-${item.href === '/' ? 'home' : item.href.replace(/^\//, '').replace(/[/]+/g, '-')}`}
								data-nav-target={item.href}
								class={`group/menu inline-flex items-center gap-2 rounded-md px-3 py-3 transition-all duration-200 ${
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
								<span>{item.label}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</div>
</header>

<!-- 모바일 드롭다운 메뉴 -->
{#if mobileMenuOpen}
	<div class="fixed inset-0 z-1100 flex flex-col md:hidden">
		<!-- 오버레이 -->
		<button
			type="button"
			class="lc-overlay-backdrop absolute inset-0 cursor-default backdrop-blur-[2px]"
			aria-label="메뉴 닫기"
			tabindex="-1"
			on:click={closeMobileMenu}
		></button>
		<!-- 메뉴 패널 -->
		<nav
			id="mobile-menu-panel"
			use:trapFocus
			class="relative z-10 w-full rounded-b-md border-b border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-4 pt-6"
			aria-label="모바일 메뉴"
			data-testid="mobile-navigation"
			transition:fly={{ y: -16, duration: 180, opacity: 0 }}
		>
			<div class="mb-4 flex items-center justify-end">
				<button
					type="button"
					on:click={() => theme.toggle()}
					class="lc-theme-switch inline-flex cursor-pointer items-center rounded-full border p-1 transition-all duration-200"
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
							class={`group/menu inline-flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-200 ${
								isActive(item.href)
									? 'border border-[var(--lc-border-strong)] bg-[var(--lc-surface-accent)] text-[var(--lc-text-primary)] shadow-sm'
									: 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-accent)]'
							}`}
							style="min-height:44px"
							on:click={closeMobileMenu}
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
		background: color-mix(in srgb, var(--lc-header-gradient) 92%, transparent);
		border-color: var(--lc-border-soft);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		transition:
			background-color 180ms ease,
			border-color 180ms ease,
			box-shadow 200ms ease,
			backdrop-filter 200ms ease;
	}

	.lc-header-shell.is-at-top {
		box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
	}

	.lc-header-shell.is-scrolled {
		background: color-mix(in srgb, var(--lc-header-gradient) 80%, transparent);
		border-color: color-mix(in srgb, var(--lc-border-soft) 74%, var(--lc-border-strong) 26%);
		box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.lc-brand-wordmark {
		color: var(--lc-text-primary);
	}
</style>
