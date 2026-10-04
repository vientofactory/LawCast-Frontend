<script lang="ts">
	/**
	 * Magic-wand sparkle animation shown while a search request is in flight.
	 * Purely decorative: callers own the `role="status"` wording, and every
	 * moving part stops under `prefers-reduced-motion`.
	 *
	 * - `stage`: the full wand-sweeping-through-sparkles scene
	 * - `sweep`: a wand glint gliding along a thin rail
	 */
	let { variant = 'stage' }: { variant?: 'stage' | 'sweep' } = $props();
</script>

{#if variant === 'stage'}
	<div class="wand-stage" data-testid="wand-sparkle-stage" aria-hidden="true">
		<svg class="wand-stage-svg" viewBox="0 0 260 170" focusable="false">
			<defs>
				<path
					id="ws-stage-sparkle"
					d="M0 -10 C0.8 -4.4 4.4 -0.8 10 0 C4.4 0.8 0.8 4.4 0 10 C-0.8 4.4 -4.4 0.8 -10 0 C-4.4 -0.8 -0.8 -4.4 0 -10 Z"
				/>
				<radialGradient id="ws-stage-glow">
					<stop offset="0%" stop-color="var(--lc-text-accent)" stop-opacity="0.5" />
					<stop offset="100%" stop-color="var(--lc-text-accent)" stop-opacity="0" />
				</radialGradient>
				<linearGradient id="ws-stage-wand" x1="0" y1="1" x2="0" y2="0">
					<stop offset="0%" stop-color="var(--lc-text-accent)" />
					<stop offset="100%" stop-color="#8b5cf6" />
				</linearGradient>
			</defs>

			<!-- Stardust trail arcing across the sweep path of the wand tip. -->
			<path class="wand-trail" d="M29 52 Q130 6 231 52" />

			<!-- Ambient sparkle field the wand sweeps through. -->
			<g transform="translate(34,40) scale(0.75)">
				<use href="#ws-stage-sparkle" class="spark spark-gold" style="animation-delay: 0.1s" />
			</g>
			<g transform="translate(70,92) scale(0.5)">
				<use href="#ws-stage-sparkle" class="spark spark-accent" style="animation-delay: 0.5s" />
			</g>
			<g transform="translate(58,120) scale(0.65)">
				<use href="#ws-stage-sparkle" class="spark spark-violet" style="animation-delay: 1.1s" />
			</g>
			<g transform="translate(104,44) scale(0.55)">
				<use href="#ws-stage-sparkle" class="spark spark-violet" style="animation-delay: 0.8s" />
			</g>
			<g transform="translate(130,98) scale(0.7)">
				<use href="#ws-stage-sparkle" class="spark spark-gold" style="animation-delay: 1.6s" />
			</g>
			<g transform="translate(166,46) scale(0.6)">
				<use href="#ws-stage-sparkle" class="spark spark-accent" style="animation-delay: 0.3s" />
			</g>
			<g transform="translate(196,90) scale(0.8)">
				<use href="#ws-stage-sparkle" class="spark spark-violet" style="animation-delay: 1.3s" />
			</g>
			<g transform="translate(228,42) scale(0.5)">
				<use href="#ws-stage-sparkle" class="spark spark-gold" style="animation-delay: 1.9s" />
			</g>
			<g transform="translate(236,114) scale(0.6)">
				<use href="#ws-stage-sparkle" class="spark spark-accent" style="animation-delay: 0.9s" />
			</g>
			<g transform="translate(18,98) scale(0.45)">
				<use href="#ws-stage-sparkle" class="spark spark-violet" style="animation-delay: 2.2s" />
			</g>

			<!-- Dust motes drifting upward for depth. -->
			<g transform="translate(52,102)"
				><circle class="dust" r="2.2" style="animation-delay: 0.2s" /></g
			>
			<g transform="translate(118,72)"
				><circle class="dust" r="1.8" style="animation-delay: 1s" /></g
			>
			<g transform="translate(184,108)"
				><circle class="dust" r="2" style="animation-delay: 1.7s" /></g
			>
			<g transform="translate(222,78)"
				><circle class="dust" r="1.6" style="animation-delay: 2.4s" /></g
			>

			<!-- The wand: sweeps back and forth through the sparkle field. -->
			<g class="wand-sweep-group">
				<circle class="wand-glow" cx="0" cy="-118" r="34" fill="url(#ws-stage-glow)" />
				<rect
					class="wand-handle"
					x="-5.5"
					y="-88"
					width="11"
					height="88"
					rx="5.5"
					fill="url(#ws-stage-wand)"
				/>
				<rect class="wand-collar" x="-12" y="-99" width="24" height="13" rx="6.5" />
				<g transform="translate(0,-118) scale(1.7)">
					<use href="#ws-stage-sparkle" class="wand-star" />
				</g>
				<!-- Sparks trailing just behind the wand tip. -->
				<g transform="translate(-32,-88) scale(0.55)">
					<use href="#ws-stage-sparkle" class="spark spark-accent" style="animation-delay: 0.35s" />
				</g>
				<g transform="translate(-46,-56) scale(0.4)">
					<use href="#ws-stage-sparkle" class="spark spark-violet" style="animation-delay: 0.75s" />
				</g>
			</g>
		</svg>
	</div>
{:else}
	<div class="wand-sweep" data-testid="wand-sparkle-sweep" aria-hidden="true">
		<span class="wand-sweep-rail"></span>
		<span class="wand-sweep-wake"></span>
		<span class="wand-sweep-mote" style="left: 20%; animation-delay: 0s"></span>
		<span class="wand-sweep-mote" style="left: 50%; animation-delay: 0.55s"></span>
		<span class="wand-sweep-mote" style="left: 80%; animation-delay: 1.1s"></span>
		<span class="wand-sweep-glider">
			<span class="wand-sweep-star"></span>
			<span class="wand-sweep-stick"></span>
		</span>
	</div>
{/if}

<style>
	/* ---------- stage: the full wand + sparkle field scene ---------- */

	.wand-stage {
		width: 260px;
		max-width: 100%;
	}

	.wand-stage-svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.spark {
		fill: currentColor;
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
		animation: spark-twinkle 2.4s ease-in-out infinite;
	}

	.spark-accent {
		color: var(--lc-text-accent);
	}

	.spark-violet {
		color: #8b5cf6;
	}

	.spark-gold {
		color: #f59e0b;
	}

	.dust {
		fill: var(--lc-text-dim);
		opacity: 0;
		animation: dust-rise 3s ease-in-out infinite;
	}

	.wand-trail {
		fill: none;
		stroke: var(--lc-text-accent);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-dasharray: 1 11;
		opacity: 0.5;
		animation: trail-shimmer 3.2s linear infinite;
	}

	.wand-sweep-group {
		transform-box: view-box;
		transform-origin: 0 0;
		animation: wand-sweep 3.2s ease-in-out infinite;
	}

	.wand-collar {
		fill: #f59e0b;
	}

	.wand-glow {
		animation: glow-pulse 1.8s ease-in-out infinite;
	}

	.wand-star {
		fill: #fbbf24;
		transform-box: fill-box;
		transform-origin: center;
		animation: wand-star-pulse 1.8s ease-in-out infinite;
	}

	@keyframes wand-sweep {
		0% {
			transform: translate(95px, 150px) rotate(-34deg);
		}
		25% {
			transform: translate(130px, 142px) rotate(0deg);
		}
		50% {
			transform: translate(165px, 150px) rotate(34deg);
		}
		75% {
			transform: translate(130px, 142px) rotate(0deg);
		}
		100% {
			transform: translate(95px, 150px) rotate(-34deg);
		}
	}

	@keyframes spark-twinkle {
		0%,
		100% {
			transform: scale(0.15);
			opacity: 0;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
		65% {
			transform: scale(0.8);
			opacity: 0.55;
		}
	}

	@keyframes dust-rise {
		0% {
			transform: translateY(6px);
			opacity: 0;
		}
		35% {
			opacity: 0.85;
		}
		100% {
			transform: translateY(-12px);
			opacity: 0;
		}
	}

	@keyframes trail-shimmer {
		0% {
			stroke-dashoffset: 0;
		}
		100% {
			stroke-dashoffset: -24;
		}
	}

	@keyframes glow-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
	}

	@keyframes wand-star-pulse {
		0%,
		100% {
			transform: scale(0.88);
			opacity: 0.85;
		}
		50% {
			transform: scale(1.12);
			opacity: 1;
		}
	}

	/* ---------- sweep: wand glint gliding along a thin rail ---------- */

	.wand-sweep {
		position: relative;
		width: 100%;
		height: 26px;
	}

	.wand-sweep-rail {
		position: absolute;
		top: 50%;
		right: 0;
		left: 0;
		height: 4px;
		margin-top: -2px;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--lc-surface-accent) 74%, var(--lc-surface-primary) 26%);
	}

	.wand-sweep-wake {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 72px;
		height: 6px;
		margin-top: -3px;
		border-radius: 9999px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--lc-text-accent) 60%, transparent),
			transparent
		);
		filter: blur(2px);
		opacity: 0.8;
		animation: sweep-glide 1.8s ease-in-out infinite;
		animation-delay: 0.12s;
	}

	.wand-sweep-glider {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 30px;
		height: 30px;
		margin: -15px 0 0 -15px;
		animation: sweep-glide 1.8s ease-in-out infinite;
	}

	.wand-sweep-star {
		position: absolute;
		top: 2px;
		left: 13px;
		width: 13px;
		height: 13px;
		background: #fbbf24;
		clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%);
		filter: drop-shadow(0 0 4px color-mix(in srgb, #fbbf24 70%, transparent));
		animation: wand-star-pulse 1.8s ease-in-out infinite;
	}

	.wand-sweep-stick {
		position: absolute;
		top: 13px;
		left: 7px;
		width: 4px;
		height: 13px;
		border-radius: 2px;
		background: linear-gradient(180deg, #8b5cf6, var(--lc-text-accent));
		transform: rotate(-42deg);
		transform-origin: top center;
	}

	.wand-sweep-mote {
		position: absolute;
		top: 50%;
		width: 7px;
		height: 7px;
		margin-top: -3.5px;
		margin-left: -3.5px;
		background: #8b5cf6;
		clip-path: polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%);
		opacity: 0;
		animation: spark-twinkle 2.2s ease-in-out infinite;
	}

	@keyframes sweep-glide {
		0% {
			left: 4%;
		}
		50% {
			left: 96%;
		}
		100% {
			left: 4%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spark,
		.dust,
		.wand-trail,
		.wand-sweep-group,
		.wand-glow,
		.wand-star,
		.wand-sweep-wake,
		.wand-sweep-glider,
		.wand-sweep-star,
		.wand-sweep-mote {
			animation: none;
		}

		.spark {
			opacity: 0.85;
			transform: none;
		}

		.wand-sweep-mote {
			opacity: 0.85;
		}
	}
</style>
