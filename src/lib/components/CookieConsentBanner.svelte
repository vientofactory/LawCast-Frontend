<script lang="ts">
	import {
		getCookieConsent,
		setCookieConsent,
		loadGtmAfterConsent,
		type CookieConsentStatus
	} from '$lib/utils/consent';
	import { GTM_CONTAINER_ID } from '$lib/utils/gtm';

	// Measurement policy shown in the banner. Kept as a plain constant so
	// the linked document can be swapped without touching the markup.
	const ANALYTICS_POLICY_URL = 'https://marketingplatform.google.com/about/analytics/terms/kr/';

	// Null means undecided — the banner must be shown.
	let consent = $state<CookieConsentStatus | null>(null);
	let bannerVisible = $state(false);

	// When no container ID is configured at build time, analytics is
	// disabled and none of the consent code below runs.
	const isAnalyticsEnabled = GTM_CONTAINER_ID !== '';

	$effect(() => {
		if (!isAnalyticsEnabled) return;
		consent = getCookieConsent();
		bannerVisible = consent === null;
		// Returning visitors who already accepted get the container
		// injected here on mount; first-time visitors get it on accept.
		if (consent === 'accepted') {
			loadGtmAfterConsent();
		}
	});

	function choose(status: CookieConsentStatus): void {
		setCookieConsent(status);
		consent = status;
		bannerVisible = false;
		if (status === 'accepted') {
			loadGtmAfterConsent();
		}
	}

	function reopen(): void {
		bannerVisible = true;
	}
</script>

{#if isAnalyticsEnabled && bannerVisible}
	<div
		data-testid="cookie-consent-banner"
		role="dialog"
		aria-live="polite"
		aria-label="Cookie consent"
		class="lc-cookie-consent pointer-events-none fixed inset-x-0 bottom-0 z-[9990] px-4 pb-4 sm:px-6 sm:pb-6"
	>
		<div
			class="lc-cookie-consent-card pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] p-4 shadow-xl sm:flex-row sm:items-center sm:gap-4 sm:p-5"
		>
			<p class="lc-text-secondary flex-1 text-sm leading-relaxed">
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
			<div class="flex shrink-0 gap-2">
				<button
					type="button"
					data-testid="cookie-consent-decline"
					class="rounded-lg border border-[var(--lc-border-soft)] px-4 py-2 text-sm font-semibold text-[var(--lc-text-secondary)] transition-all duration-200 hover:bg-[var(--lc-surface-hover)] cursor-pointer"
					onclick={() => choose('declined')}
				>
					거부
				</button>
				<button
					type="button"
					data-testid="cookie-consent-accept"
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 cursor-pointer"
					onclick={() => choose('accepted')}
				>
					동의
				</button>
			</div>
		</div>
	</div>
{:else if consent !== null}
	<!-- Collapsed entry point so visitors can revisit their decision. -->
	<button
		type="button"
		data-testid="cookie-settings-button"
		aria-label="Open cookie settings"
		class="fixed bottom-4 left-4 z-[9989] rounded-full border border-[var(--lc-border-soft)] bg-[var(--lc-surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--lc-text-muted)] shadow-lg transition-all duration-200 hover:text-[var(--lc-text-primary)] cursor-pointer"
		onclick={reopen}
	>
		쿠키 설정
	</button>
{/if}

{#if consent === 'accepted' && GTM_CONTAINER_ID}
	<!-- GTM noscript fallback, rendered only after an explicit accept. -->
	<noscript>
		<iframe
			src="https://www.googletagmanager.com/ns.html?id={GTM_CONTAINER_ID}"
			height="0"
			width="0"
			style="display:none;visibility:hidden"
			title="Google Tag Manager"
		></iframe>
	</noscript>
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
</style>
