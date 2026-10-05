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
		<g transform="translate(118,72)"><circle class="dust" r="1.8" style="animation-delay: 1s" /></g>
		<g transform="translate(184,108)"><circle class="dust" r="2" style="animation-delay: 1.7s" /></g
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
</style>
