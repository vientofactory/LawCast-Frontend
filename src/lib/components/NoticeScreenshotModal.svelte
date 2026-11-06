<script lang="ts">
	import { tick } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faDownload, faImage, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
	import ModalShell from './ModalShell.svelte';
	import NoticeScreenshot from './NoticeScreenshot.svelte';

	let {
		isOpen = false,
		src,
		noticeNum,
		format = 'jpeg',
		returnFocus,
		onClose
	}: {
		isOpen?: boolean;
		src: string;
		noticeNum: number;
		format?: string;
		returnFocus?: HTMLElement;
		onClose: () => void;
	} = $props();

	let viewport = $state<HTMLDivElement>();
	let viewportWidth = $state(0);
	let naturalWidth = $state(0);
	let mode = $state<'fit' | 'manual'>('fit');
	let zoom = $state(1);
	let dragging = $state(false);
	let drag: { x: number; y: number; left: number; top: number; pointerId: number } | null = null;
	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 4;
	// Account for viewport padding and the image's two border pixels.
	let scale = $derived(
		mode === 'fit' && naturalWidth > 0
			? Math.min(1, Math.max(1, viewportWidth - 26) / naturalWidth)
			: zoom
	);
	let imageWidth = $derived(naturalWidth > 0 ? naturalWidth * scale : undefined);

	$effect(() => {
		// Reopening or navigating to another capture starts at a useful fit width.
		void src;
		if (!isOpen) return;
		naturalWidth = 0;
		mode = 'fit';
		zoom = 1;
		drag = null;
		dragging = false;
	});

	async function changeZoom(next: number | 'fit') {
		if (!viewport || !naturalWidth) return;
		const centerX = (viewport.scrollLeft + viewport.clientWidth / 2 - 12) / scale;
		const centerY = (viewport.scrollTop + viewport.clientHeight / 2 - 12) / scale;
		mode = next === 'fit' ? 'fit' : 'manual';
		if (next !== 'fit') zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
		await tick();
		if (!viewport) return;
		viewport.scrollLeft = next === 'fit' ? 0 : centerX * scale + 12 - viewport.clientWidth / 2;
		viewport.scrollTop = centerY * scale + 12 - viewport.clientHeight / 2;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target !== viewport || event.ctrlKey || event.metaKey || event.altKey) return;
		const key = event.key;
		if (!['+', '=', '-', '0', '1'].includes(key)) return;
		event.preventDefault();
		void changeZoom(key === '0' ? 'fit' : key === '1' ? 1 : scale * (key === '-' ? 0.8 : 1.25));
	}

	function startPan(event: PointerEvent) {
		if (
			event.pointerType !== 'mouse' ||
			event.button !== 0 ||
			!viewport ||
			!naturalWidth ||
			(event.target as Element).closest('button, a')
		)
			return;
		event.preventDefault();
		viewport.focus({ preventScroll: true });
		drag = {
			x: event.clientX,
			y: event.clientY,
			left: viewport.scrollLeft,
			top: viewport.scrollTop,
			pointerId: event.pointerId
		};
		dragging = true;
		viewport.setPointerCapture(event.pointerId);
	}

	function movePan(event: PointerEvent) {
		if (!drag || !viewport || event.pointerId !== drag.pointerId) return;
		viewport.scrollLeft = drag.left + drag.x - event.clientX;
		viewport.scrollTop = drag.top + drag.y - event.clientY;
	}

	function endPan(event: PointerEvent) {
		if (drag?.pointerId !== event.pointerId) return;
		if (viewport?.hasPointerCapture(event.pointerId))
			viewport.releasePointerCapture(event.pointerId);
		drag = null;
		dragging = false;
	}
</script>

<ModalShell
	{isOpen}
	{onClose}
	{returnFocus}
	stickyHeader
	maxWidthClass="max-w-6xl lc-screenshot-dialog"
	labelledBy="notice-screenshot-modal-title"
	testId="notice-screenshot-modal"
>
	{#snippet icon()}<FontAwesomeIcon icon={faImage} class="lc-text-accent h-5 w-5" />{/snippet}
	{#snippet title()}국회 페이지 미리보기{/snippet}
	{#snippet subtitle()}의안번호 {noticeNum} · 수집 시점의 국회 입법예고 화면{/snippet}

	<p id="screenshot-viewer-hint" class="lc-text-secondary mb-2 text-sm">
		확대 후 화면을 밀거나 드래그해 이동하세요.<span class="ml-2 hidden sm:inline">
			+ / − 확대·축소, 0 화면 맞춤, 1 원본 크기</span
		>
	</p>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (The named scroll region needs a keyboard target.) -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Keyboard shortcuts and pointer panning operate on the scroll region.) -->
	<div
		bind:this={viewport}
		bind:clientWidth={viewportWidth}
		class="lc-panel-inset lc-screenshot-viewport rounded-lg border"
		class:is-panning={dragging}
		data-testid="screenshot-viewport"
		tabindex="0"
		role="region"
		aria-label="아카이브 스크린샷 보기 영역"
		aria-describedby="screenshot-viewer-hint"
		onkeydown={handleKeydown}
		onpointerdown={startPan}
		onpointermove={movePan}
		onpointerup={endPan}
		onpointercancel={endPan}
		onlostpointercapture={endPan}
	>
		{#key src}<NoticeScreenshot
				{src}
				{noticeNum}
				{imageWidth}
				frameless
				onLoad={(size) => {
					viewportWidth = viewport?.clientWidth ?? viewportWidth;
					naturalWidth = size.width;
				}}
			/>{/key}
	</div>
	<div
		class="lc-screenshot-dock"
		data-testid="screenshot-tools"
		role="group"
		aria-label="스크린샷 보기 조절"
	>
		<div class="lc-screenshot-zoom-tools">
			<button
				type="button"
				class="lc-button-neutral lc-screenshot-control"
				data-testid="screenshot-zoom-out"
				aria-label="스크린샷 축소"
				disabled={!naturalWidth || scale <= MIN_ZOOM}
				onclick={() => changeZoom(scale * 0.8)}
				><FontAwesomeIcon icon={faMinus} class="h-4 w-4" /></button
			>
			<output
				class="lc-text-primary min-w-12 text-center text-sm tabular-nums"
				data-testid="screenshot-zoom-value"
				aria-label="확대 비율"
				aria-live="polite">{naturalWidth ? `${Math.round(scale * 100)}%` : '—'}</output
			>
			<button
				type="button"
				class="lc-button-neutral lc-screenshot-control"
				data-testid="screenshot-zoom-in"
				aria-label="스크린샷 확대"
				disabled={!naturalWidth || scale >= MAX_ZOOM}
				onclick={() => changeZoom(scale * 1.25)}
				><FontAwesomeIcon icon={faPlus} class="h-4 w-4" /></button
			>
		</div>
		<div class="lc-screenshot-mode-tools">
			<button
				type="button"
				class="lc-button-neutral lc-screenshot-control"
				data-testid="screenshot-fit"
				aria-pressed={mode === 'fit'}
				disabled={!naturalWidth}
				onclick={() => changeZoom('fit')}>화면 맞춤</button
			>
			<button
				type="button"
				class="lc-button-neutral lc-screenshot-control"
				data-testid="screenshot-original"
				aria-pressed={mode === 'manual' && zoom === 1}
				disabled={!naturalWidth}
				onclick={() => changeZoom(1)}>원본 크기</button
			>
		</div>
		<a
			href={src}
			download={`notice-${noticeNum}-screenshot.${format}`}
			data-testid="notice-detail-screenshot-download"
			class="lc-button-neutral lc-screenshot-control"
			><FontAwesomeIcon icon={faDownload} class="h-4 w-4" />다운로드</a
		>
	</div>
</ModalShell>

<style>
	:global(.lc-screenshot-dialog) {
		display: flex;
		flex-direction: column;
		height: min(90dvh, 64rem);
		overflow: hidden;
		padding: clamp(0.5rem, 2vw, 1.5rem);
	}
	:global(.lc-screenshot-dialog > :first-child) {
		flex-shrink: 0;
	}
	.lc-screenshot-dock {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		padding-bottom: env(safe-area-inset-bottom, 0px);
		border-top: 1px solid var(--lc-border-soft);
		flex-shrink: 0;
	}
	.lc-screenshot-zoom-tools {
		grid-column: 1 / -1;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.25rem;
	}
	.lc-screenshot-mode-tools {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem;
	}
	@media (min-width: 640px) {
		.lc-screenshot-dock {
			display: flex;
			justify-content: center;
		}
		.lc-screenshot-mode-tools {
			display: flex;
		}
	}

	.lc-screenshot-control {
		display: inline-flex;
		min-height: 3rem;
		min-width: 3rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		white-space: nowrap;
		border: 1px solid var(--lc-border-soft);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.lc-screenshot-control[aria-pressed='true'] {
		background: var(--lc-surface-accent);
		border-color: var(--lc-border-strong);
		color: var(--lc-text-primary);
	}
	@media (hover: none) {
		/* A touch-generated hover must not look like a second selected view mode. */
		.lc-screenshot-control:not([aria-pressed='true']):hover {
			background: var(--lc-surface-primary);
			border-color: var(--lc-border-soft);
			color: var(--lc-text-secondary);
		}
	}
	.lc-screenshot-control:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.lc-screenshot-viewport {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: auto;
		padding: 12px;
		overscroll-behavior: contain;
		touch-action: pan-x pan-y pinch-zoom;
		cursor: grab;
	}
	.lc-screenshot-viewport.is-panning {
		cursor: grabbing;
		user-select: none;
	}
</style>
