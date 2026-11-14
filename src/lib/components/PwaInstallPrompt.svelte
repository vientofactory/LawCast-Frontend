<script lang="ts">
	import Alert from '#lib/components/Alert.svelte';
	import { onMount } from 'svelte';
	import { floatingPrompt } from '#lib/utils/floating-prompt-motion.ts';

	interface InstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	const DISMISSED_KEY = 'lawcast-pwa-dismissed-at';
	const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
	let deferredPrompt = $state.raw<InstallPromptEvent | null>(null);
	let error = $state('');
	let displayedPrompt = $state.raw<InstallPromptEvent | null>(null);
	let installing = $state(false);
	let samsungInternet = $state(false);
	let manualOffer = $state(false);
	let snoozedInSession = false;
	let installedInSession = false;
	const showOffer = $derived(deferredPrompt !== null || manualOffer);

	function retainOffer(node: HTMLElement) {
		const root = document.documentElement;
		const reserve = () => {
			const value = `${Math.max(0, window.innerHeight - node.getBoundingClientRect().top)}px`;
			if (root.style.getPropertyValue('--lc-install-prompt-space') !== value)
				root.style.setProperty('--lc-install-prompt-space', value);
		};
		const resize = new ResizeObserver(reserve);
		resize.observe(node);
		const position = new MutationObserver(reserve);
		position.observe(root, { attributes: true, attributeFilter: ['style'] });
		window.addEventListener('resize', reserve);
		node.addEventListener('introend', reserve);
		reserve();
		return {
			destroy() {
				resize.disconnect();
				position.disconnect();
				window.removeEventListener('resize', reserve);
				node.removeEventListener('introend', reserve);
				root.style.removeProperty('--lc-install-prompt-space');
				if (!deferredPrompt) displayedPrompt = null;
			}
		};
	}

	function snooze() {
		deferredPrompt = null;
		manualOffer = false;
		snoozedInSession = true;
		try {
			localStorage.setItem(DISMISSED_KEY, String(Date.now()));
		} catch {
			// Installation remains usable when storage is unavailable.
		}
	}

	onMount(() => {
		const supportsInstallation = window.isSecureContext && 'serviceWorker' in navigator;
		// Match the browser token, not Samsung hardware or its embedded Chrome version.
		samsungInternet =
			/SamsungBrowser\//i.test(navigator.userAgent) && /Android/i.test(navigator.userAgent);
		const standalone = window.matchMedia('(display-mode: standalone)');
		const isInstalled = () =>
			installedInSession ||
			standalone.matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone;
		const canOffer = () => {
			if (!supportsInstallation || isInstalled() || snoozedInSession) return false;
			try {
				const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY));
				if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return false;
			} catch {
				// Storage restrictions must not hide installation permanently.
			}
			return true;
		};
		// Samsung's browser-owned installation UI can remain available without an event.
		manualOffer = samsungInternet && canOffer();
		const beforeInstall = (event: Event) => {
			if (!supportsInstallation || isInstalled()) return;
			event.preventDefault();
			if (installing || !canOffer()) return;
			error = '';
			deferredPrompt = event as InstallPromptEvent;
			displayedPrompt = deferredPrompt;
		};
		const installed = () => {
			installedInSession = true;
			manualOffer = false;
			deferredPrompt = null;
			error = '';
		};
		const displayChanged = () => {
			if (standalone.matches) installed();
		};
		window.addEventListener('beforeinstallprompt', beforeInstall);
		window.addEventListener('appinstalled', installed);
		standalone.addEventListener('change', displayChanged);
		if (supportsInstallation) {
			// Reuse the push worker's script and scope to preserve subscriptions.
			void navigator.serviceWorker.register('/sw.js').catch(() => {
				// A failed registration must not interrupt normal browsing.
			});
		}
		return () => {
			window.removeEventListener('beforeinstallprompt', beforeInstall);
			window.removeEventListener('appinstalled', installed);
			standalone.removeEventListener('change', displayChanged);
		};
	});

	async function install() {
		const event = deferredPrompt;
		if (!event || installing) return;
		installing = true;
		manualOffer = false;
		deferredPrompt = null;
		try {
			// The native dialog requires a direct user gesture and a single-use event.
			await event.prompt();
			if ((await event.userChoice).outcome === 'dismissed') snooze();
			// Acceptance is not proof that Android finished installing a WebAPK.
			else if (samsungInternet && !installedInSession) manualOffer = true;
		} catch {
			displayedPrompt = null;
			if (installedInSession) return;
			manualOffer = samsungInternet;
			error = '설치 창을 열지 못했습니다. 브라우저 메뉴에서 앱 설치를 선택해 주세요.';
		} finally {
			installing = false;
		}
	}
</script>

{#if showOffer}
	<aside
		use:retainOffer
		transition:floatingPrompt
		inert={!showOffer}
		data-testid="pwa-install-prompt"
		aria-label="LawCast 앱 설치"
		aria-live="polite"
		class="fixed inset-x-3 z-[9988] mx-auto w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-4 shadow-xl sm:right-6 sm:left-auto sm:max-w-md sm:p-5"
		style="--lc-install-bottom: max(calc(5rem + env(safe-area-inset-bottom)), calc(var(--lc-consent-banner-height, 0px) + 0.75rem)); bottom: var(--lc-install-bottom); max-height: calc(100dvh - var(--lc-install-bottom) - 0.75rem);"
	>
		<div class="flex items-center gap-3">
			<img src="/brand/v2/icon-192.png" alt="" width="48" height="48" class="shrink-0 rounded-lg" />
			<div class="min-w-0">
				<p class="lc-text-primary font-semibold">
					{samsungInternet && !deferredPrompt
						? '삼성 인터넷에서 LawCast 설치하기'
						: 'LawCast를 앱으로 설치할까요?'}
				</p>
				<p class="lc-text-secondary mt-1 text-sm">홈 화면에서 입법예고를 더 편하게 확인하세요.</p>
			</div>
		</div>
		{#if samsungInternet}
			<div data-testid="pwa-samsung-install-help" class="lc-text-secondary mt-3 space-y-2 text-sm">
				<p>
					삼성 인터넷의 주소창 설치 아이콘 또는 메뉴의 ‘현재 페이지 추가’ → ‘홈 화면’을 확인해
					주세요. 버전에 따라 메뉴 이름이 다를 수 있습니다.
				</p>
				<p>
					‘앱으로 설치’와 ‘바로가기 추가’가 함께 표시되면 앱 설치를 선택하세요. 바로가기는
					브라우저에서 열릴 수 있습니다.
				</p>
				<p>
					설치가 완료되지 않거나 Android에서 차단되면 삼성 인터넷을 업데이트하거나, 같은 주소를
					Chrome에서 열어 설치해 보세요. 설치 창을 확인해도 실제 설치가 끝나지 않을 수 있습니다.
				</p>
				{#if error}<p role="status" class="lc-text-primary">{error}</p>{/if}
			</div>
		{/if}
		<div class="mt-3 flex justify-end gap-2">
			<button
				type="button"
				class="lc-button-secondary min-h-[44px] cursor-pointer border px-4 py-2 text-sm font-semibold"
				data-testid="pwa-install-dismiss"
				disabled={!showOffer}
				onclick={() => {
					error = '';
					snooze();
				}}>나중에</button
			>
			{#if displayedPrompt && (!samsungInternet || deferredPrompt)}
				<button
					type="button"
					class="lc-button-primary min-h-[44px] cursor-pointer px-4 py-2 text-sm font-semibold"
					data-testid="pwa-install-button"
					disabled={!deferredPrompt}
					onclick={install}>앱 설치</button
				>
			{/if}
		</div>
	</aside>
{/if}

{#if error && !samsungInternet}<Alert
		type="error"
		message={error}
		onDismiss={() => (error = '')}
		testId="pwa-install-error"
	/>{/if}

<style>
	aside {
		transition: bottom 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		aside {
			transition: none;
		}
	}
</style>
