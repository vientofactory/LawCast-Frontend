// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		// Heterogeneous entries: event objects and gtag-style command arrays
		// such as ['consent', 'default', params].
		dataLayer?: unknown[];
	}
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
export {};
