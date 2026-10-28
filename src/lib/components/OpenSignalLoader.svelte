<script lang="ts">
	import { BRAND_ARC, BRAND_LETTER, BRAND_DOT } from '$lib/brand-symbol';
</script>

<div class="lc-signal-loader" data-testid="open-signal-loader" aria-hidden="true">
	<svg viewBox="0 0 260 170" focusable="false">
		<path class="lc-signal-guide" d="M28 85H76M180 85h52" />
		<g transform="translate(82 37) scale(1.5)">
			<path class="lc-signal-base" d={BRAND_ARC} />
			<path class="lc-signal-arc" d={BRAND_ARC} pathLength="100" />
			<path class="lc-signal-letter" d={BRAND_LETTER} />
			<circle class="lc-signal-dot" cx={BRAND_DOT.cx} cy={BRAND_DOT.cy} r="5" />
			<circle class="lc-signal-echo" cx={BRAND_DOT.cx} cy={BRAND_DOT.cy} r={BRAND_DOT.r} />
			<circle
				class="lc-signal-echo lc-signal-echo-delayed"
				cx={BRAND_DOT.cx}
				cy={BRAND_DOT.cy}
				r={BRAND_DOT.r}
			/>
		</g>
		<circle class="lc-signal-input" cx="33" cy="85" r="3" />
	</svg>
</div>

<style>
	.lc-signal-loader {
		width: 260px;
		max-width: 100%;
		color: var(--lc-text-accent);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.lc-signal-guide {
		fill: none;
		stroke: var(--lc-text-dim);
		stroke-width: 2;
		stroke-dasharray: 2 7;
		opacity: 0.35;
	}

	.lc-signal-base,
	.lc-signal-arc,
	.lc-signal-letter,
	.lc-signal-echo {
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.lc-signal-base,
	.lc-signal-arc {
		stroke-width: 8;
	}

	.lc-signal-base {
		opacity: 0.12;
	}

	.lc-signal-arc {
		stroke-dasharray: 100;
	}

	.lc-signal-letter {
		stroke-width: 5;
	}

	.lc-signal-dot,
	.lc-signal-input {
		fill: currentColor;
	}

	.lc-signal-echo {
		stroke-width: 1;
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
	}

	.lc-signal-input {
		opacity: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.lc-signal-arc {
			animation: lc-signal-draw 3s ease-in-out infinite;
		}

		.lc-signal-echo {
			animation: lc-signal-echo 3s ease-out infinite;
		}

		.lc-signal-echo-delayed {
			animation-delay: 0.3s;
		}

		.lc-signal-input {
			animation: lc-signal-input 3s ease-in-out infinite;
		}
	}

	@keyframes lc-signal-draw {
		0%,
		100% {
			stroke-dashoffset: 100;
			opacity: 0.25;
		}
		45%,
		75% {
			stroke-dashoffset: 0;
			opacity: 1;
		}
		90% {
			stroke-dashoffset: 0;
			opacity: 0.25;
		}
	}

	@keyframes lc-signal-echo {
		0%,
		35% {
			transform: scale(1);
			opacity: 0;
		}
		45% {
			opacity: 0.4;
		}
		80%,
		100% {
			transform: scale(3);
			opacity: 0;
		}
	}

	@keyframes lc-signal-input {
		0%,
		10% {
			transform: translateX(0);
			opacity: 0;
		}
		25% {
			opacity: 0.7;
		}
		45%,
		100% {
			transform: translateX(40px);
			opacity: 0;
		}
	}
</style>
