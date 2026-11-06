import type { FailureKind } from '#lib/utils/request-failure.ts';
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		// Event objects and gtag command Arguments objects share this queue.
		dataLayer?: unknown[];
	}
	namespace App {
		interface Error {
			message: string;
			kind?: FailureKind;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
export {};
