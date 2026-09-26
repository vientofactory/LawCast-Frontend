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
 * 180/200ms animation window.
 */
export interface ModalTransitionSample {
	seen: boolean;
	minBackdropOpacity: number;
	minDialogScale: number;
}

export async function startModalTransitionSample(page: Page): Promise<void> {
	await page.evaluate(() => {
		const sample = { seen: false, minBackdropOpacity: 1, minDialogScale: 1 };
		(window as unknown as { __modalTransitionSample: typeof sample }).__modalTransitionSample =
			sample;

		const startedAt = performance.now();
		const tick = () => {
			const dialog = document.querySelector('[role="dialog"]');
			const backdrop = dialog?.parentElement ?? null;

			if (dialog && backdrop) {
				sample.seen = true;

				const opacity = Number.parseFloat(window.getComputedStyle(backdrop).opacity);
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

			if (performance.now() - startedAt < 3_000) {
				requestAnimationFrame(tick);
			}
		};
		requestAnimationFrame(tick);
	});
}

export async function readModalTransitionSample(page: Page): Promise<ModalTransitionSample> {
	return await page.evaluate(() => {
		const sample = (window as unknown as { __modalTransitionSample?: ModalTransitionSample })
			.__modalTransitionSample;
		return sample ?? { seen: false, minBackdropOpacity: 1, minDialogScale: 1 };
	});
}
