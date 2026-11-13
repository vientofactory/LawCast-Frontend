<script lang="ts">
	import { BRAND_ARC, BRAND_LETTER, BRAND_DOT } from '#lib/brand-symbol.js';

	let { compact = false, animate = false }: { compact?: boolean; animate?: boolean } = $props();

	// Expand the original radius-25 arc by its half-width (5), including round caps.
	const arcCenterX = 48 - Math.sqrt(25 ** 2 - 19 ** 2);
	const arcNormalX = (48 - arcCenterX) / 25;
	const arcOuterX = 48 + 5 * arcNormalX;
	const arcInnerX = 48 - 5 * arcNormalX;
	const arcContour = `M${arcOuterX} 9.2 A30 30 0 1 0 ${arcOuterX} 54.8 A5 5 0 0 0 ${arcInnerX} 47.2 A20 20 0 1 1 ${arcInnerX} 16.8 A5 5 0 0 0 ${arcOuterX} 9.2 Z`;
	// Expand the L's width-6 stroke; retain its round endpoints and outer corner.
	const letterContour = 'M20 24 A3 3 0 0 1 26 24 V38 H36 A3 3 0 0 1 36 44 H23 A3 3 0 0 1 20 41 Z';
	const dotContour = `M${BRAND_DOT.cx + BRAND_DOT.r} ${BRAND_DOT.cy} a${BRAND_DOT.r} ${BRAND_DOT.r} 0 1 1 ${-2 * BRAND_DOT.r} 0 a${BRAND_DOT.r} ${BRAND_DOT.r} 0 1 1 ${2 * BRAND_DOT.r} 0 Z`;

	function traceSymbol(node: SVGSVGElement) {
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		const trigger = node.closest('a') ?? node;
		let animations: Animation[] = [];
		const cancel = () => animations.forEach((animation) => animation.cancel());
		function play() {
			// WebKit may update a fresh query before dispatching a retained query change.
			if (
				!animate ||
				matchMedia(preference.media).matches ||
				animations.some((a) => a.playState === 'running')
			)
				return;
			cancel();
			const options: KeyframeAnimationOptions = {
				duration: 4000,
				easing: 'linear',
				fill: 'backwards'
			};
			// Give each contour a long, sine-like sweep instead of a short acceleration burst.
			// Offset the turns so one contour redraws while the next is still retracting.
			const easing = 'cubic-bezier(0.37, 0, 0.63, 1)';
			animations = [
				node.querySelector('[data-brand-fill]')!.animate(
					[
						{ opacity: 1, offset: 0, easing },
						{ opacity: 0, offset: 0.1 },
						{ opacity: 0, offset: 0.9, easing },
						{ opacity: 1, offset: 1 }
					],
					options
				),
				// Hand the silhouette back to the fill before the effect is removed.
				// An opaque boundary overlay would otherwise vanish abruptly at completion.
				node.querySelector('[data-brand-outline]')!.animate(
					[
						{ visibility: 'visible', opacity: 0, offset: 0, easing },
						{ visibility: 'visible', opacity: 1, offset: 0.1 },
						{ visibility: 'visible', opacity: 1, offset: 0.9, easing },
						{ visibility: 'visible', opacity: 0, offset: 1 }
					],
					options
				),
				...Array.from(node.querySelectorAll<SVGPathElement>('[data-brand-outline] path')).map(
					(path, index) => {
						// Retain an arc fragment so the symbol never disappears completely.
						const retreat = [82, 94, 100][index];
						return path.animate(
							[
								{ strokeDashoffset: 0, offset: 0 },
								{ strokeDashoffset: 0, offset: 0.16 - index * 0.02, easing },
								{ strokeDashoffset: retreat, offset: 0.46 + index * 0.04, easing },
								{ strokeDashoffset: 0, offset: 0.84 + index * 0.02 },
								{ strokeDashoffset: 0, offset: 1 }
							],
							options
						);
					}
				)
			];
		}
		function onPreference() {
			if (matchMedia(preference.media).matches) cancel();
		}
		function onPointerEnter(event: Event) {
			if (event instanceof PointerEvent && event.pointerType === 'mouse') play();
		}
		trigger.addEventListener('pointerenter', onPointerEnter);
		preference.addEventListener('change', onPreference);
		node.dataset.motionReady = 'true';
		return {
			destroy() {
				cancel();
				delete node.dataset.motionReady;
				trigger.removeEventListener('pointerenter', onPointerEnter);
				preference.removeEventListener('change', onPreference);
			}
		};
	}
</script>

<span class:compact class="lc-brand-logo" role="img" aria-label="LawCast" data-testid="brand-logo">
	<svg
		use:traceSymbol
		data-testid="brand-symbol"
		class="lc-brand-symbol"
		viewBox="0 0 64 64"
		aria-hidden="true"
	>
		<g class:lc-brand-fill-motion={animate} data-brand-fill data-testid="brand-fill">
			<path
				class="lc-brand-arc"
				data-testid="brand-arc"
				d={BRAND_ARC}
				pathLength="100"
				fill="none"
				stroke="currentColor"
				stroke-width="10"
				stroke-linecap="round"
			></path>
			<path
				class="lc-brand-letter"
				data-testid="brand-letter"
				d={BRAND_LETTER}
				pathLength="100"
				fill="none"
				stroke="currentColor"
				stroke-width="6"
				stroke-linecap="round"
				stroke-linejoin="round"
			></path>
			<circle
				class="lc-brand-dot"
				data-testid="brand-dot"
				cx={BRAND_DOT.cx}
				cy={BRAND_DOT.cy}
				r={BRAND_DOT.r}
				fill="currentColor"
				stroke="currentColor"
				stroke-width="0"
			></circle>
		</g>
		<g
			data-brand-outline
			data-testid="brand-outline"
			class="lc-brand-outline"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{#each [arcContour, letterContour, dotContour] as contour, index (contour)}
				<path d={contour} pathLength="100" data-testid={`brand-contour-${index}`} />
			{/each}
		</g>
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

	.lc-brand-fill-motion {
		/* Keep the same compositing path before, during and after the opacity animation. */
		will-change: opacity;
	}

	.lc-brand-outline {
		visibility: hidden;
		opacity: 0;
	}

	.lc-brand-outline path {
		stroke-dasharray: 100 100;
	}
</style>
