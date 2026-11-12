import { onMount, untrack } from 'svelte';
import {
	getFailureKind,
	getFailureStatus,
	getFailureRetryAfter,
	type LoadErrorPayload
} from '#lib/utils/request-failure.ts';
import { toUserFacingErrorMessage } from '#lib/utils/error-message.util.ts';

export function freshFetch(signal: AbortSignal): typeof fetch {
	return (input, init) =>
		fetch(input, {
			...init,
			signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
			cache: 'no-store'
		});
}

/** A component-owned read: no shared visitor state or persistent payload cache. */
export class RealtimeRead<T> {
	data = $state.raw<T | undefined>();
	loading = $state(true);
	error = $state<LoadErrorPayload | null>(null);
	retryAfter = $state(0);
	private controller: AbortController | null = null;
	private pending: Promise<void> | null = null;
	private generation = 0;
	private lastAttempt = 0;
	private retryAt = 0;

	constructor(
		private read: (signal: AbortSignal) => Promise<T>,
		private fallback: string
	) {}

	reset() {
		this.generation++;
		this.controller?.abort();
		this.pending = null;
		this.data = undefined;
		this.error = null;
		this.loading = true;
		this.retryAt = 0;
		this.retryAfter = 0;
		this.lastAttempt = 0;
	}

	tick() {
		this.retryAfter = Math.max(0, Math.ceil((this.retryAt - Date.now()) / 1000));
	}

	refresh = (): Promise<void> => {
		this.tick();
		if (this.pending) return this.pending;
		if (this.retryAfter > 0) return Promise.resolve();
		const generation = this.generation;
		const controller = new AbortController();
		this.controller = controller;
		this.loading = true;
		this.lastAttempt = Date.now();
		this.pending = (async () => {
			try {
				const result = await this.read(controller.signal);
				if (generation !== this.generation || controller.signal.aborted) return;
				this.data = result;
				this.error = null;
				this.retryAt = 0;
			} catch (error) {
				if (generation !== this.generation || controller.signal.aborted) return;
				const status = getFailureStatus(error);
				const retryAfter = getFailureRetryAfter(error);
				this.retryAt = Date.now() + retryAfter * 1000;
				this.error = {
					status,
					kind: getFailureKind(error),
					message: toUserFacingErrorMessage(error, this.fallback),
					...(status === 429 ? { retryAfter } : {})
				};
			} finally {
				if (generation === this.generation) {
					this.loading = false;
					this.pending = null;
					this.tick();
				}
			}
		})();
		return this.pending;
	};

	refreshIfStale(maxAge: number) {
		if (Date.now() - this.lastAttempt >= maxAge) void this.refresh();
	}

	dispose() {
		this.generation++;
		this.controller?.abort();
	}
}

/** Poll only visible documents; focus and visibility events share the same in-flight read. */
export function activateRealtimeRead<T>(read: RealtimeRead<T>, maxAge = 30000, initial = true) {
	onMount(() => {
		if (initial) untrack(() => void read.refresh());
		const check = () => {
			read.tick();
			if (document.visibilityState === 'visible') read.refreshIfStale(maxAge);
		};
		const timer = setInterval(check, 1000);
		window.addEventListener('focus', check);
		document.addEventListener('visibilitychange', check);
		return () => {
			clearInterval(timer);
			window.removeEventListener('focus', check);
			document.removeEventListener('visibilitychange', check);
			read.dispose();
		};
	});
}
