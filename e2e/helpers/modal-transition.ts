import type { Page } from '@playwright/test';

/**
 * ModalShell plays its intro `fade` on the backdrop (the dialog's direct parent)
 * and `scale` on the dialog itself. Those intro transitions only run when the
 * modal block is created by an update — a dynamically imported modal that mounts
 * with `isOpen=true` in the same flush renders that DOM as part of its *initial*
 * render, so the modal pops in with no transition (regression: FullUnsubscribeConfirmModal).
 *
 * A rAF sampler started *before* the open click records the minimum computed
 * styles across the whole open, so the assertion does not have to race the
 * 180/200ms animation window. Keep it alive through intervening axe scans,
 * which can take several seconds in a cross-engine run.
 */
export interface ModalTransitionSample {
	seen: boolean;
	minBackdropOpacity: number;
	minDialogScale: number;
	minDialogOpacity: number;
	closingFrames: number;
	minClosingOpacity: number;
	closingLockPreserved: boolean;
	maxAnimationDuration: number;
}

export async function startModalTransitionSample(
	page: Page,
	selector = '[role="dialog"]'
): Promise<void> {
	await page.evaluate((selector) => {
		const sample = {
			seen: false,
			minBackdropOpacity: 1,
			minDialogScale: 1,
			minDialogOpacity: 1,
			closingFrames: 0,
			minClosingOpacity: 1,
			closingLockPreserved: true,
			maxAnimationDuration: 0
		};
		(window as unknown as { __modalTransitionSample: typeof sample }).__modalTransitionSample =
			sample;

		const startedAt = performance.now();
		const tick = () => {
			if (
				(window as unknown as { __modalTransitionSample: typeof sample })
					.__modalTransitionSample !== sample
			)
				return;
			const dialog = document.querySelector<HTMLElement>(selector);
			const backdrop = dialog?.parentElement ?? null;

			if (dialog && backdrop) {
				sample.seen = true;
				const dialogOpacity = Number(getComputedStyle(dialog).opacity);
				sample.minDialogOpacity = Math.min(sample.minDialogOpacity, dialogOpacity);
				for (const animation of dialog.getAnimations()) {
					const duration = Number(animation.effect?.getTiming().duration);
					if (Number.isFinite(duration))
						sample.maxAnimationDuration = Math.max(sample.maxAnimationDuration, duration);
				}
				if (dialog.dataset.modalPhase === 'closing') {
					sample.closingFrames++;
					sample.minClosingOpacity = Math.min(sample.minClosingOpacity, dialogOpacity);
					sample.closingLockPreserved &&=
						dialog.matches(':modal') && document.body.style.overflow === 'hidden';
				}

				const opacity = Number.parseFloat(
					(dialog instanceof HTMLDialogElement
						? window.getComputedStyle(dialog, '::backdrop')
						: window.getComputedStyle(backdrop)
					).opacity
				);
				if (Number.isFinite(opacity)) {
					sample.minBackdropOpacity = Math.min(sample.minBackdropOpacity, opacity);
				}

				const transform = window.getComputedStyle(dialog).transform;
				if (transform && transform !== 'none') {
					const firstValue = transform.slice(transform.indexOf('(') + 1).split(/[,\s]/)[0];
					const scale = Number.parseFloat(firstValue);
					if (Number.isFinite(scale)) {
						sample.minDialogScale = Math.min(sample.minDialogScale, scale);
					}
				}
			}

			if (performance.now() - startedAt < 30_000) {
				requestAnimationFrame(tick);
			}
		};
		requestAnimationFrame(tick);
	}, selector);
}

export async function readModalTransitionSample(page: Page): Promise<ModalTransitionSample> {
	return await page.evaluate(() => {
		const sample = (window as unknown as { __modalTransitionSample?: ModalTransitionSample })
			.__modalTransitionSample;
		return (
			sample ?? {
				seen: false,
				minBackdropOpacity: 1,
				minDialogScale: 1,
				minDialogOpacity: 1,
				closingFrames: 0,
				minClosingOpacity: 1,
				closingLockPreserved: true,
				maxAnimationDuration: 0
			}
		);
	});
}
