/**
 * Cookie consent store for analytics gating.
 * The choice is persisted in `localStorage` so returning visitors keep
 * their decision; clearing site data resets the banner.
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

let gtmInjected = false;

/**
 * Inject the GTM container script after an explicit consent accept.
 * The container ID comes from `GTM_CONTAINER_ID` (`src/lib/utils/gtm.ts`,
 * baked at build time). Safe to call repeatedly; later calls are no-ops.
 * Does nothing when no container ID is configured.
 */
export function loadGtmAfterConsent(): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (gtmInjected || !GTM_CONTAINER_ID) return;
	gtmInjected = true;
	window.dataLayer = window.dataLayer || [];
	window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
	const first = document.getElementsByTagName('script')[0];
	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`;
	first?.parentNode?.insertBefore(script, first);
}
