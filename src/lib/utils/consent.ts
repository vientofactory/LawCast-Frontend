/**
 * Cookie consent store for analytics gating (Consent Mode Basic).
 * The choice is persisted in `localStorage` so returning visitors keep
 * their decision; clearing site data resets the banner. The decision is
 * also reported to Google through the official Consent Mode
 * `default`/`update` commands, so Tag Assistant can connect regardless
 * of the consent state.
 */
import { GTM_CONTAINER_ID } from './gtm';

export const COOKIE_CONSENT_KEY = 'lawcast-cookie-consent';

export type CookieConsentStatus = 'accepted' | 'declined';

/**
 * Read the stored consent decision. Returns `null` when undecided
 * (banner must be shown) or when running outside the browser.
 */
export function getCookieConsent(): CookieConsentStatus | null {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
	try {
		const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
		return stored === 'accepted' || stored === 'declined' ? stored : null;
	} catch {
		return null;
	}
}

/** Persist the consent decision. Returns false when storage is unavailable. */
export function setCookieConsent(status: CookieConsentStatus): boolean {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false;
	try {
		window.localStorage.setItem(COOKIE_CONSENT_KEY, status);
		return true;
	} catch {
		return false;
	}
}

/** Remove the stored decision so the banner shows again. */
export function clearCookieConsent(): void {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
	try {
		window.localStorage.removeItem(COOKIE_CONSENT_KEY);
	} catch {
		// Storage may be blocked; the banner simply shows again next load.
	}
}

/** True only when the visitor has explicitly accepted tracking. */
export function isTrackingConsented(): boolean {
	return getCookieConsent() === 'accepted';
}

/**
 * Push a Consent Mode `default` command. The gtag.js snippet in the SSR
 * response head (`+layout.svelte`) already seeds the same default before
 * the container loads; this call re-asserts it once the bundle runs so
 * Tag Assistant still connects when the head snippet is blocked. Everything
 * starts `denied` (Basic implementation) unless the visitor previously
 * accepted, in which case the stored decision seeds the default directly.
 * `wait_for_update` gives the banner a short window to apply the stored
 * decision before tags fire.
 */
function pushConsentDefault(granted: boolean): void {
	if (typeof window === 'undefined') return;
	window.dataLayer = window.dataLayer || [];
	const state = granted ? 'granted' : 'denied';
	window.dataLayer.push([
		'consent',
		'default',
		{
			ad_storage: state,
			ad_user_data: state,
			ad_personalization: state,
			analytics_storage: state,
			wait_for_update: 500
		}
	]);
}

/**
 * Report the visitor's choice through the official Consent Mode `update`
 * path. Safe to call when GTM is blocked or absent; the command simply
 * sits unread in the dataLayer.
 */
export function pushConsentUpdate(status: CookieConsentStatus): void {
	if (typeof window === 'undefined') return;
	window.dataLayer = window.dataLayer || [];
	const state = status === 'accepted' ? 'granted' : 'denied';
	window.dataLayer.push([
		'consent',
		'update',
		{
			ad_storage: state,
			ad_user_data: state,
			ad_personalization: state,
			analytics_storage: state
		}
	]);
}

/**
 * Initialize Consent Mode (Basic) without waiting for a decision. Denied
 * defaults keep Google tags blocked until the visitor accepts. The gtag.js
 * container itself loads from the SSR response head (`+layout.svelte`), not
 * from the JS bundle, so Tag Assistant verifies it without executing
 * bundled code. The container ID comes from `GTM_CONTAINER_ID`
 * (`src/lib/utils/gtm.ts`, baked at build time). Does nothing when no
 * container ID is configured.
 */
export function initConsentMode(): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (!GTM_CONTAINER_ID) return;
	pushConsentDefault(getCookieConsent() === 'accepted');
}
