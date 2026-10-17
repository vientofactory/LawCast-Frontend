/**
 * Cookie consent store for analytics gating.
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
	if (typeof window === 'undefined') return null;
	try {
		const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
		return stored === 'accepted' || stored === 'declined' ? stored : null;
	} catch {
		return null;
	}
}

/** Persist the consent decision. Returns false when storage is unavailable. */
export function setCookieConsent(status: CookieConsentStatus): boolean {
	if (typeof window === 'undefined') return false;
	try {
		window.localStorage.setItem(COOKIE_CONSENT_KEY, status);
		return true;
	} catch {
		return false;
	}
}

/** Remove the stored decision so the banner shows again. */
export function clearCookieConsent(): void {
	if (typeof window === 'undefined') return;
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

type ConsentSettings = {
	ad_storage: 'denied';
	ad_user_data: 'denied';
	ad_personalization: 'denied';
	analytics_storage: 'granted' | 'denied';
};

/** Queue the Arguments object expected by Google's command API, not an Array. */
function queueConsentCommand(
	_command: 'consent',
	_action: 'update',
	_settings: ConsentSettings
): void {
	if (typeof window === 'undefined') return;
	window.dataLayer = window.dataLayer || [];
	// Google distinguishes Arguments commands from arrays of event data.
	// eslint-disable-next-line prefer-rest-params
	window.dataLayer.push(arguments);
}

/** Apply the visitor's analytics choice without granting advertising consent. */
export function pushConsentUpdate(status: CookieConsentStatus): void {
	queueConsentCommand('consent', 'update', {
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
		analytics_storage: status === 'accepted' ? 'granted' : 'denied'
	});
}

/**
 * Reconcile the persisted choice using an update, never a second default.
 * The SSR bootstrap sets denied defaults before GTM and restores returning
 * visitors before their first page view. GTM's denied-default override also
 * requires an explicit update signal, even for previously accepted visitors.
 */
export function initConsentMode(): void {
	if (typeof window === 'undefined' || !GTM_CONTAINER_ID) return;
	pushConsentUpdate(getCookieConsent() === 'accepted' ? 'accepted' : 'declined');
}
