<script lang="ts">
	import {
		getCookieConsent,
		setCookieConsent,
		initConsentMode,
		pushConsentUpdate,
		type CookieConsentStatus
	} from '$lib/utils/consent';
	import { GTM_CONTAINER_ID, pushGtmPageView } from '$lib/utils/gtm';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCookieBite } from '@fortawesome/free-solid-svg-icons';

	// Measurement policy shown in the banner. Kept as a plain constant so
	// the linked document can be swapped without touching the markup.
	const ANALYTICS_POLICY_URL = 'https://marketingplatform.google.com/about/analytics/terms/kr/';

	// How long the collapsed settings entry point shows its text label
	// before morphing into the icon-only form.
	const SETTINGS_LABEL_MS = 3000;

	// Null means undecided — the banner must be shown.
	let consent = $state<CookieConsentStatus | null>(null);
	let bannerVisible = $state(false);

	// True while the settings shortcut shows its text label. It starts
	// expanded so first-time visitors notice it, then collapses to the
	// icon-only form after SETTINGS_LABEL_MS.
	let settingsExpanded = $state(true);

	// When no valid container ID (`GTM-XXXXXXX`) is configured at build
	// time, analytics is disabled and none of the consent code below runs.
	const isAnalyticsEnabled = /^GTM-[A-Za-z0-9]+$/.test(GTM_CONTAINER_ID);

	// The settings shortcut is only in the DOM once a decision exists and
	// the banner is dismissed.
	const isSettingsVisible = $derived(isAnalyticsEnabled && !bannerVisible && consent !== null);

	$effect(() => {
		if (!isAnalyticsEnabled) return;
		consent = getCookieConsent();
		bannerVisible = consent === null;
		// Restore the stored choice without resetting Google consent defaults.
		initConsentMode();
	});

	// Collapse the settings shortcut to its icon-only form a few seconds
	// after it appears. The timer resets every time the shortcut
	// re-appears (for example after dismissing the re-opened banner), and
	// hover/focus temporarily re-expands it so the label stays discoverable.
	$effect(() => {
		if (!isSettingsVisible) {
			settingsExpanded = true;
			return;
		}
		settingsExpanded = true;
		const timer = window.setTimeout(() => {
			settingsExpanded = false;
		}, SETTINGS_LABEL_MS);
		return () => window.clearTimeout(timer);
	});

	function choose(status: CookieConsentStatus): void {
		const previousConsent = getCookieConsent();
		if (!setCookieConsent(status)) return;
		consent = status;
		bannerVisible = false;
		pushConsentUpdate(status);
		if (status === 'accepted' && previousConsent !== 'accepted') {
			// Report this page once when consent is newly granted.
			pushGtmPageView(window.location.pathname + window.location.search);
		}
	}

	function reopen(): void {
		bannerVisible = true;
	}

	function peekSettingsLabel(): void {
		settingsExpanded = true;
	}

	function unpeekSettingsLabel(): void {
		settingsExpanded = false;
	}
</script>

{#if isAnalyticsEnabled && bannerVisible}
	<div
		data-testid="cookie-consent-banner"
		role="dialog"
		aria-live="polite"
		aria-label="Cookie consent"
		class="lc-cookie-consent pointer-events-none fixed inset-x-0 bottom-0 z-[9990] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-6"
	>
		<div
			class="lc-cookie-consent-card pointer-events-auto max-h-[calc(100dvh-4rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-4 shadow-xl sm:max-w-md sm:p-5"
		>
			<p class="lc-text-secondary text-sm leading-relaxed">
				LawCast는 서비스 개선을 위해 익명으로 방문 기록을 수집합니다. 동의하시면 방문한 페이지 등의
				기록이 수집됩니다. 자세한 내용은
				<a
					href={ANALYTICS_POLICY_URL}
					target="_blank"
					rel="noopener noreferrer"
					data-testid="cookie-policy-link"
					class="lc-link underline"
				>
					수집 정책
				</a>에서 확인할 수 있습니다.
			</p>
			<div class="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:justify-end">
				<button
					type="button"
					data-testid="cookie-consent-decline"
					class="min-h-[44px] flex-1 cursor-pointer rounded-lg border border-[var(--lc-border-soft)] px-4 py-2 text-sm font-semibold text-[var(--lc-text-secondary)] transition-all duration-200 hover:bg-[var(--lc-surface-hover)] sm:flex-none sm:px-5"
					onclick={() => choose('declined')}
				>
					거부
				</button>
				<button
					type="button"
					data-testid="cookie-consent-accept"
					class="min-h-[44px] flex-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 sm:flex-none sm:px-5"
					onclick={() => choose('accepted')}
				>
					동의
				</button>
			</div>
		</div>
	</div>
{:else if isSettingsVisible}
	<!-- Collapsed entry point so visitors can revisit their decision. -->
	<button
		type="button"
		data-testid="cookie-settings-button"
		data-expanded={settingsExpanded ? 'true' : 'false'}
		aria-label="쿠키 설정 열기"
		title="쿠키 설정"
		class="lc-cookie-settings fixed bottom-4 left-4 z-[9989] flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] px-3 text-xs font-semibold text-[var(--lc-text-muted)] shadow-lg transition-colors duration-200 hover:text-[var(--lc-text-primary)]"
		style="margin-bottom: env(safe-area-inset-bottom);"
		onclick={reopen}
		onmouseenter={peekSettingsLabel}
		onmouseleave={unpeekSettingsLabel}
		onfocus={peekSettingsLabel}
		onblur={unpeekSettingsLabel}
	>
		<span aria-hidden="true" class="inline-flex shrink-0"
			><FontAwesomeIcon icon={faCookieBite} class="h-4 w-4" /></span
		>
		<span class="lc-cookie-settings-label" aria-hidden={!settingsExpanded}>
			<span class="lc-cookie-settings-label-inner">쿠키 설정</span>
		</span>
	</button>
{/if}

<style>
	.lc-cookie-consent {
		animation: lc-consent-slide-up 240ms ease-out;
	}

	@keyframes lc-consent-slide-up {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Settings shortcut morph: only the label track animates (grid 0fr
	 * to 1fr), while the button keeps constant padding. Collapsed width
	 * is icon (1rem) plus horizontal padding (2 x 0.75rem) = 2.5rem,
	 * matching h-10 for a circle. Toggling a fixed width on the button
	 * itself cannot transition (fixed to auto is discrete) and caused
	 * the hover jitter, so the button only transitions colors here. */
	.lc-cookie-settings-label {
		display: grid;
		grid-template-columns: 0fr;
		margin-left: 0;
		opacity: 0;
		transition:
			grid-template-columns 350ms cubic-bezier(0.32, 0.72, 0, 1),
			margin-left 350ms cubic-bezier(0.32, 0.72, 0, 1),
			opacity 200ms ease;
	}

	.lc-cookie-settings[data-expanded='true'] .lc-cookie-settings-label {
		grid-template-columns: 1fr;
		margin-left: 0.375rem;
		opacity: 1;
	}

	.lc-cookie-settings-label-inner {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.lc-cookie-consent {
			animation: none;
		}

		.lc-cookie-settings-label {
			transition: none;
		}
	}
</style>
