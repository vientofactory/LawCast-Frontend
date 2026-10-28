<script lang="ts">
	import { onMount } from 'svelte';

	interface InstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	const DISMISSED_KEY = 'lawcast-pwa-dismissed-at';
	const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
	let deferredPrompt = $state.raw<InstallPromptEvent | null>(null);
	let error = $state('');

	function snooze() {
		deferredPrompt = null;
		try {
			localStorage.setItem(DISMISSED_KEY, String(Date.now()));
		} catch {
			// Installation remains usable when storage is unavailable.
		}
	}

	onMount(() => {
		let installedInSession = false;
		const standalone = window.matchMedia('(display-mode: standalone)');
		const isInstalled = () =>
			installedInSession ||
			standalone.matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone;
		const beforeInstall = (event: Event) => {
			if (isInstalled()) return;
			event.preventDefault();
			try {
				const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY));
				if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return;
			} catch {
				// Storage restrictions must not hide installation permanently.
			}
			error = '';
			deferredPrompt = event as InstallPromptEvent;
		};
		const installed = () => {
			installedInSession = true;
			deferredPrompt = null;
			error = '';
		};
		const displayChanged = () => {
			if (standalone.matches) installed();
		};
		window.addEventListener('beforeinstallprompt', beforeInstall);
		window.addEventListener('appinstalled', installed);
		standalone.addEventListener('change', displayChanged);
		if ('serviceWorker' in navigator && window.isSecureContext) {
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
		if (!event) return;
		deferredPrompt = null;
		try {
			// The native dialog requires a direct user gesture and a single-use event.
			await event.prompt();
			if ((await event.userChoice).outcome === 'dismissed') snooze();
		} catch {
			error = '설치 창을 열지 못했습니다. 브라우저 메뉴에서 앱 설치를 선택해 주세요.';
		}
	}
</script>

{#if deferredPrompt || error}
	<aside
		data-testid="pwa-install-prompt"
		aria-label="LawCast 앱 설치"
		aria-live="polite"
		class="fixed inset-x-3 z-[9988] mx-auto w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-4 shadow-xl sm:right-6 sm:left-auto sm:max-w-md sm:p-5"
		style="--lc-install-bottom: max(calc(5rem + env(safe-area-inset-bottom)), calc(var(--lc-consent-banner-height, 0px) + 0.75rem)); bottom: var(--lc-install-bottom); max-height: calc(100dvh - var(--lc-install-bottom) - 0.75rem);"
	>
		<div class="flex items-center gap-3">
			<img src="/brand/v2/icon-192.png" alt="" width="48" height="48" class="shrink-0 rounded-lg" />
			<div class="min-w-0">
				<p class="lc-text-primary font-semibold">LawCast를 앱으로 설치할까요?</p>
				<p class="lc-text-secondary mt-1 text-sm">홈 화면에서 입법예고를 더 편하게 확인하세요.</p>
			</div>
		</div>
		{#if error}<p class="lc-text-secondary mt-2 text-sm" role="status">{error}</p>{/if}
		<div class="mt-3 flex justify-end gap-2">
			<button
				type="button"
				class="lc-button-secondary min-h-[44px] cursor-pointer border px-4 py-2 text-sm font-semibold"
				data-testid="pwa-install-dismiss"
				onclick={() => {
					error = '';
					snooze();
				}}>나중에</button
			>
			{#if deferredPrompt}
				<button
					type="button"
					class="lc-button-primary min-h-[44px] cursor-pointer px-4 py-2 text-sm font-semibold"
					data-testid="pwa-install-button"
					onclick={install}>앱 설치</button
				>
			{/if}
		</div>
	</aside>
{/if}
