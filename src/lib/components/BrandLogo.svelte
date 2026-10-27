<script module lang="ts">
	// Claim the intro only in the browser; SSR must never share visitor state.
	let introClaimed = false;
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { BRAND_ARC, BRAND_LETTER, BRAND_DOT } from '$lib/brand-symbol';

	let { compact = false, animate = false }: { compact?: boolean; animate?: boolean } = $props();
	// Route headers may remount during client navigation; play once per document load.
	const playIntro = untrack(() => animate && (!browser || !introClaimed));
	if (browser && playIntro) introClaimed = true;
</script>

<span
	class:compact
	class:assembling={playIntro}
	class="lc-brand-logo"
	role="img"
	aria-label="LawCast"
	data-testid="brand-logo"
	data-intro={playIntro}
>
	<svg class="lc-brand-symbol" viewBox="0 0 64 64" aria-hidden="true">
		<path
			class="lc-brand-arc"
			data-testid="brand-arc"
			d={BRAND_ARC}
			pathLength="100"
			fill="none"
			stroke="currentColor"
			stroke-width="10"
			stroke-linecap="round"
		/>
		<path
			class="lc-brand-letter"
			data-testid="brand-letter"
			d={BRAND_LETTER}
			fill="none"
			stroke="currentColor"
			stroke-width="6"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<circle
			class="lc-brand-echo"
			cx={BRAND_DOT.cx}
			cy={BRAND_DOT.cy}
			r={BRAND_DOT.r}
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<circle
			class="lc-brand-dot"
			data-testid="brand-dot"
			cx={BRAND_DOT.cx}
			cy={BRAND_DOT.cy}
			r={BRAND_DOT.r}
			fill="currentColor"
		/>
	</svg>
	<span class="lc-brand-wordmark" data-testid="brand-wordmark" aria-hidden="true">
		<img src="/brand/v2/wordmark-light.svg" alt="" width="179" height="64" class="lc-brand-light" />
		<img src="/brand/v2/wordmark-dark.svg" alt="" width="179" height="64" class="lc-brand-dark" />
	</span>
</span>

<style>
	.lc-brand-logo {
		position: relative;
		display: inline-block;
		flex-shrink: 0;
		width: calc(2.5rem * 259 / 64);
		height: 2.5rem;
		vertical-align: middle;
		color: #1d4ed8;
	}

	.compact {
		width: calc(2rem * 259 / 64);
		height: 2rem;
	}

	.lc-brand-symbol {
		position: absolute;
		inset: 0 auto 0 0;
		width: calc(100% * 64 / 259);
		height: 100%;
		overflow: visible;
	}

	.lc-brand-wordmark {
		position: absolute;
		inset: 0 0 0 auto;
		width: calc(100% * 179 / 259);
		height: 100%;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
	}

	.lc-brand-dark {
		display: none;
	}

	:global(html[data-theme='dark']) .lc-brand-logo {
		color: #60a5fa;
	}

	:global(html[data-theme='dark']) .lc-brand-light {
		display: none;
	}

	:global(html[data-theme='dark']) .lc-brand-dark {
		display: block;
	}

	.lc-brand-arc,
	.lc-brand-letter {
		transform-origin: 32px 32px;
	}

	.lc-brand-dot,
	.lc-brand-echo {
		transform-box: fill-box;
		transform-origin: center;
	}

	.lc-brand-echo {
		opacity: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.assembling .lc-brand-arc {
			stroke-dasharray: 100;
			animation: lc-assemble-arc 720ms cubic-bezier(0.22, 1, 0.36, 1) 100ms both;
		}

		.assembling .lc-brand-letter {
			animation: lc-assemble-letter 560ms cubic-bezier(0.34, 1.56, 0.64, 1) 360ms both;
		}

		.assembling .lc-brand-dot {
			animation: lc-assemble-dot 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 760ms both;
		}

		.assembling .lc-brand-echo {
			animation: lc-signal-echo 600ms ease-out 960ms both;
		}

		.assembling .lc-brand-wordmark {
			animation: lc-reveal-wordmark 700ms cubic-bezier(0.22, 1, 0.36, 1) 1000ms both;
		}
	}

	@keyframes lc-assemble-arc {
		from {
			stroke-dashoffset: 100;
			transform: rotate(-55deg) scale(0.85);
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		to {
			stroke-dashoffset: 0;
			transform: rotate(0) scale(1);
			opacity: 1;
		}
	}

	@keyframes lc-assemble-letter {
		from {
			transform: translate(-5px, 13px) rotate(-12deg);
			opacity: 0;
		}
		to {
			transform: translate(0, 0) rotate(0);
			opacity: 1;
		}
	}

	@keyframes lc-assemble-dot {
		from {
			transform: translate(-9px, -12px) scale(0.1);
			opacity: 0;
		}
		to {
			transform: translate(0, 0) scale(1);
			opacity: 1;
		}
	}

	@keyframes lc-signal-echo {
		from {
			transform: scale(0.8);
			opacity: 0;
		}
		20% {
			opacity: 0.5;
		}
		to {
			transform: scale(2.4);
			opacity: 0;
		}
	}

	@keyframes lc-reveal-wordmark {
		from {
			clip-path: inset(0 100% 0 0);
			transform: translateX(-10px);
			opacity: 0;
		}
		to {
			clip-path: inset(0 0 0 0);
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
