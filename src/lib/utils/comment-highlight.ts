type Highlight = { target: HTMLElement; dispose: () => void };
let activeHighlight: Highlight | undefined;

export function clearCommentHighlight(target: HTMLElement): void {
	if (activeHighlight?.target === target) {
		activeHighlight.dispose();
		activeHighlight = undefined;
	}
}

export function highlightComment(target: HTMLElement, scroll = true): void {
	activeHighlight?.dispose();
	let frame = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const highlight: Highlight = {
		target,
		dispose() {
			cancelAnimationFrame(frame);
			clearTimeout(timer);
			target.classList.remove('lc-comment-highlight');
		}
	};
	activeHighlight = highlight;

	function reveal() {
		if (!target.isConnected) {
			clearCommentHighlight(target);
			return;
		}
		target.classList.add('lc-comment-highlight');
		timer = setTimeout(() => clearCommentHighlight(target), 2200);
	}

	if (!scroll) {
		reveal();
		return;
	}

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	target.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
	const started = performance.now();
	let previousTop = target.getBoundingClientRect().top;
	let stableFrames = 0;

	// Start the hold after arrival, not while the target is still offscreen.
	function waitForArrival() {
		const top = target.getBoundingClientRect().top;
		stableFrames = Math.abs(top - previousTop) < 0.5 ? stableFrames + 1 : 0;
		previousTop = top;
		if (stableFrames >= 3 || performance.now() - started >= 1800) {
			reveal();
		} else {
			frame = requestAnimationFrame(waitForArrival);
		}
	}
	frame = requestAnimationFrame(waitForArrival);
}
