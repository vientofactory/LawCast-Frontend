<script lang="ts">
	import { fly } from 'svelte/transition';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { page } from '$app/state';
	import {
		faChartLine,
		faFileLines,
		faHouse,
		faBars,
		faLink
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
		{ href: '/webhook', label: '웹훅 등록', icon: faLink },
		{ href: '/status', label: '시스템 상태', icon: faChartLine }
	];

	function isActive(href: string): boolean {
		const currentPath = page.url.pathname.replace(/\/+$/, '') || '/';
		if (href === '/') return currentPath === '/';
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}

	let mobileMenuOpen = false;
	let menuButton: HTMLButtonElement;

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
	function closeMobileMenu() {
		mobileMenuOpen = false;
		menuButton?.focus();
	}

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
	class="border-b border-slate-200/70 bg-linear-to-r from-white/95 via-sky-50/80 to-indigo-50/65 shadow-lg shadow-sky-100/40 backdrop-blur-md"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex flex-wrap items-center justify-between gap-4 py-5">
			<a
				href="/"
				class="text-decoration-none group flex items-center gap-4 transition-all duration-300 hover:scale-[1.02]"
			>
				<div>
					<span
						class="bg-linear-to-r from-slate-800 via-sky-700 to-indigo-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent"
					>
						LawCast
					</span>
					<p class="mt-1 text-sm font-medium text-slate-600">국회 입법예고 스냅샷 아카이브</p>
				</div>
			</a>

			<!-- 햄버거/닫기 버튼 -->
			<button
				bind:this={menuButton}
				class="inline-flex items-center justify-center rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 md:hidden"
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
				class="hidden w-full rounded-2xl border border-white/70 bg-white/65 p-2 shadow-sm backdrop-blur-sm md:block md:w-auto"
				aria-label="주요 메뉴"
			>
				<ul class="flex flex-wrap items-center justify-center gap-1.5 text-sm font-semibold">
					{#each menuItems as item (item.href)}
						<li>
							<a
								href={item.href}
								aria-current={isActive(item.href) ? 'page' : undefined}
								class={`group/menu inline-flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-200 ${
									isActive(item.href)
										? 'border border-sky-200 bg-linear-to-r from-sky-100 to-indigo-100 text-slate-800 shadow-sm shadow-sky-100/70'
										: 'text-slate-700 hover:bg-sky-50 hover:text-sky-700'
								}`}
								style="min-height:44px"
							>
								<span
									class={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${isActive(item.href) ? 'bg-white/70 text-sky-800' : 'bg-sky-100 text-sky-700 group-hover/menu:bg-sky-200'}`}
								>
									<FontAwesomeIcon icon={item.icon} class="h-3.5 w-3.5" />
								</span>
								<span>{item.label}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>

			<a
				href="https://github.com/vientofactory/lawcast"
				target="_blank"
				rel="noopener noreferrer"
				class="hidden items-center justify-center rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 md:inline-flex"
				aria-label="GitHub 저장소 열기"
			>
				<FontAwesomeIcon icon={faGithub} class="h-5 w-5" />
			</a>
		</div>
	</div>
</header>

<!-- 모바일 드롭다운 메뉴 -->
{#if mobileMenuOpen}
	<div class="fixed inset-0 z-1100 flex flex-col md:hidden">
		<!-- 오버레이 -->
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-black/10"
			aria-label="메뉴 닫기"
			tabindex="-1"
			on:click={closeMobileMenu}
		></button>
		<!-- 메뉴 패널 -->
		<nav
			id="mobile-menu-panel"
			use:trapFocus
			class="relative z-10 w-full rounded-b-2xl border-b border-slate-200/70 bg-white/95 p-4 pt-6 shadow-lg"
			aria-label="모바일 메뉴"
			transition:fly={{ y: -16, duration: 180, opacity: 0 }}
		>
			<ul class="flex flex-col gap-2 text-base font-semibold">
				{#each menuItems as item (item.href)}
					<li>
						<a
							href={item.href}
							aria-current={isActive(item.href) ? 'page' : undefined}
							class={`group/menu inline-flex items-center gap-2 rounded-xl px-3 py-3 transition-all duration-200 ${
								isActive(item.href)
									? 'border border-sky-200 bg-linear-to-r from-sky-100 to-indigo-100 text-slate-800 shadow-sm shadow-sky-100/70'
									: 'text-slate-700 hover:bg-sky-50 hover:text-sky-700'
							}`}
							style="min-height:44px"
							on:click={closeMobileMenu}
						>
							<span
								class={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${isActive(item.href) ? 'bg-white/70 text-sky-800' : 'bg-sky-100 text-sky-700 group-hover/menu:bg-sky-200'}`}
							>
								<FontAwesomeIcon icon={item.icon} class="h-3.5 w-3.5" />
							</span>
							<span>{item.label}</span>
						</a>
					</li>
				{/each}
				<li>
					<a
						href="https://github.com/vientofactory/lawcast"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-3 text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-800"
						aria-label="GitHub 저장소 열기"
						on:click={closeMobileMenu}
					>
						<FontAwesomeIcon icon={faGithub} class="h-5 w-5" />
						<span>GitHub</span>
					</a>
				</li>
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
</style>
