/**
 * Reusable retry-countdown timer for rate-limit overlays.
 *
 * Manages the countdown timer, retry guard, and cleanup logic.
 * Uses setter callbacks so the owning Svelte component's reactive
 * variables stay in sync (plain class properties are invisible to
 * Svelte's reactivity system).
 *
 * Usage in a legacy Svelte page:
 * ```ts
 * import { RetryCountdown } from '$lib/utils/retry-countdown.util';
 * import { onDestroy } from 'svelte';
 *
 * let countdown = 0;
 * let isRetrying = false;
 *
 * const retry = new RetryCountdown(
 *   () => invalidateAll(),
 *   (v) => { countdown = v; },
 *   (v) => { isRetrying = v; },
 * );
 * onDestroy(() => retry.destroy());
 *
 * // In a $: block reacting to loadError changes:
 * $: if (data.loadError !== retry.lastSeenError) {
 *   retry.lastSeenError = data.loadError;
 *   if (data.loadError?.retryAfter && data.loadError.retryAfter > 0) {
 *     retry.start(data.loadError.retryAfter);
 *   } else {
 *     retry.stop();
 *   }
 * }
 * ```
 */
export class RetryCountdown {
	private _timer: ReturnType<typeof setInterval> | null = null;
	private _countdownValue = 0;
	private _retryingValue = false;

	/** Tracks the last-seen loadError identity for change detection in $: blocks. */
	lastSeenError: { message: string; retryAfter?: number } | null | undefined = undefined;

	constructor(
		private readonly onRetryFn: () => void | Promise<void>,
		private readonly setCountdown: (v: number) => void,
		private readonly setIsRetrying: (v: boolean) => void
	) {}

	/** Start a countdown from `seconds`. Any existing timer is stopped first. */
	start(seconds: number): void {
		this.stop();
		this._countdownValue = seconds;
		this.setCountdown(seconds);
		this._timer = setInterval(() => {
			this._countdownValue = Math.max(0, this._countdownValue - 1);
			this.setCountdown(this._countdownValue);
			if (this._countdownValue === 0 && this._timer) {
				clearInterval(this._timer);
				this._timer = null;
			}
		}, 1000);
	}

	/** Stop the countdown and reset to 0. */
	stop(): void {
		if (this._timer) {
			clearInterval(this._timer);
			this._timer = null;
		}
		this._countdownValue = 0;
		this.setCountdown(0);
	}

	/** Invoke the retry callback if not already retrying or waiting. */
	async retry(): Promise<void> {
		if (this._countdownValue > 0 || this._retryingValue) return;
		this._retryingValue = true;
		this.setIsRetrying(true);
		try {
			await this.onRetryFn();
		} finally {
			this._retryingValue = false;
			this.setIsRetrying(false);
		}
	}

	/** Clean up the interval timer. Call from onDestroy(). */
	destroy(): void {
		this.stop();
	}
}
