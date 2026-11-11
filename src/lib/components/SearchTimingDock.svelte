<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import SearchTiming from '#lib/components/SearchTiming.svelte';
	import SearchTimingComparison from '#lib/components/SearchTimingComparison.svelte';
	import { isSearchTiming, type SearchTiming as Timing } from '#lib/utils/search-timing.ts';

	let {
		timing,
		visible,
		width = $bindable()
	}: { timing?: Timing; visible: boolean; width?: number } = $props();
	const storageKey = 'lawcast-dev-search-timing-v1';
	const layoutKey = 'lawcast-dev-search-timing-layout-v1';
	const limit = 20;
	const defaultWidth = 432;
	const minWidth = 320;
	const maxWidth = 800;
	const step = 16;
	let ready = $state(false);
	let open = $state(true);
	let preferredWidth = $state(defaultWidth);
	let widthLimit = $state(maxWidth);
	let drag = $state.raw<{ pointerId: number; startX: number; startWidth: number }>();
	let history = $state.raw<Timing[]>([]);
	let selectedId = $state('');
	let comparing = $state(false);
	let dockContent = $state<HTMLDivElement>();
	let dockToggle = $state<HTMLButtonElement>();
	let historySelect = $state<HTMLSelectElement>();
	let compareButton = $state<HTMLButtonElement>();
	let clearedAt = 0;
	const records = $derived(ready ? history : timing ? [timing] : []);
	const selected = $derived(records.find((record) => record.traceId === selectedId) ?? records[0]);
	const latest = $derived(records[0]);
	const hasBaseline = $derived(selected && latest && selected.traceId !== latest.traceId);
	const effectiveWidth = $derived(Math.min(preferredWidth, widthLimit));

	$effect(() => {
		if (!hasBaseline) comparing = false;
	});

	$effect(() => {
		width = effectiveWidth;
	});

	onMount(() => {
		try {
			const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
			if (stored && Array.isArray(stored.records)) {
				clearedAt = Number.isSafeInteger(stored.clearedAt) ? stored.clearedAt : 0;
				history = stored.records.filter(isSearchTiming).slice(0, limit);
			}
		} catch {
			// In-memory history still works if session storage is disabled.
		}
		try {
			const layout = JSON.parse(localStorage.getItem(layoutKey) ?? 'null');
			if (layout && typeof layout.open === 'boolean') open = layout.open;
			if (layout && Number.isFinite(layout.width)) {
				preferredWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(layout.width)));
			}
		} catch {
			// Default layout still works if local storage is disabled.
		}
		updateWidthLimit();
		// Commit the server-rendered record before enabling history actions.
		remember(timing);
		ready = true;
	});

	function updateWidthLimit() {
		if (!window.matchMedia('(min-width: 40rem)').matches) {
			widthLimit = maxWidth;
			return;
		}
		const available = window.matchMedia('(min-width: 80rem)').matches
			? window.innerWidth - 576
			: Math.floor(window.innerWidth * 0.66);
		widthLimit = Math.max(minWidth, Math.min(maxWidth, available));
	}

	function saveLayout() {
		try {
			localStorage.setItem(layoutKey, JSON.stringify({ open, width: preferredWidth }));
		} catch {
			// Keep the current layout even when storage is unavailable.
		}
	}

	function toggleOpen() {
		open = !open;
		saveLayout();
	}

	function resizeTo(next: number) {
		const bounded = Math.max(minWidth, Math.min(widthLimit, Math.round(next)));
		if (bounded !== effectiveWidth) preferredWidth = bounded;
	}

	function startResize(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (event.button !== 0 || !event.isPrimary || drag) return;
		event.preventDefault();
		event.currentTarget.focus({ preventScroll: true });
		event.currentTarget.setPointerCapture(event.pointerId);
		drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: effectiveWidth };
	}

	function moveResize(event: PointerEvent) {
		if (drag?.pointerId === event.pointerId)
			resizeTo(drag.startWidth + drag.startX - event.clientX);
	}

	function endResize(event: PointerEvent) {
		if (drag?.pointerId !== event.pointerId) return;
		drag = undefined;
		saveLayout();
	}

	async function resizeWithKeyboard(event: KeyboardEvent) {
		let next: number;
		switch (event.key) {
			case 'ArrowLeft':
				next = effectiveWidth + step;
				break;
			case 'ArrowRight':
				next = effectiveWidth - step;
				break;
			case 'Home':
				next = minWidth;
				break;
			case 'End':
				next = widthLimit;
				break;
			case 'Enter':
				event.preventDefault();
				toggleOpen();
				await tick();
				dockToggle?.focus({ preventScroll: true });
				return;
			default:
				return;
		}
		event.preventDefault();
		resizeTo(next);
		saveLayout();
	}

	function save(records: Timing[]) {
		history = records;
		try {
			sessionStorage.setItem(storageKey, JSON.stringify({ records, clearedAt }));
		} catch {
			// The in-memory history remains available.
		}
	}

	function remember(record?: Timing) {
		if (
			!record ||
			record.recordedAt <= clearedAt ||
			history.some(({ traceId }) => traceId === record.traceId)
		)
			return;
		const next = [record, ...history].sort((a, b) => b.recordedAt - a.recordedAt).slice(0, limit);
		if (selectedId && !next.some(({ traceId }) => traceId === selectedId)) selectedId = '';
		save(next);
	}

	$effect(() => {
		const record = timing;
		if (ready) untrack(() => remember(record));
	});

	function clearHistory() {
		clearedAt = Date.now();
		selectedId = '';
		comparing = false;
		save([]);
	}

	async function toggleComparison() {
		comparing = !comparing;
		await tick();
		if (dockContent) dockContent.scrollTop = 0;
		compareButton?.focus({ preventScroll: true });
	}

	async function restoreHistoryFocus(event: Event & { currentTarget: HTMLSelectElement }) {
		if (!comparing || event.currentTarget.value) return;
		await tick();
		historySelect?.focus({ preventScroll: true });
	}
</script>

<svelte:window onresize={updateWidthLimit} />

{#if visible && selected}
	<div
		class="fixed right-2 bottom-[calc(var(--lc-consent-banner-height,0px)+3.5rem)] z-50 flex max-h-[55dvh] flex-col items-end gap-1 sm:top-40 sm:right-4 sm:bottom-auto sm:max-h-[calc(100dvh-11rem-var(--lc-consent-banner-height,0px))]"
		style:width={open ? `min(${effectiveWidth}px, calc(100% - 1rem))` : undefined}
		data-testid="search-timing-dock"
		data-search-timing-open={open ? '' : undefined}
	>
		<button
			type="button"
			bind:this={dockToggle}
			class="lc-panel-card lc-text-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold"
			aria-expanded={open}
			aria-controls={open ? 'search-timing-dock-content' : undefined}
			data-testid="search-timing-toggle"
			disabled={!ready}
			onclick={toggleOpen}
		>
			<span>Search Timing</span>
			<span class="lc-chip-muted rounded px-1.5 tabular-nums">{records.length}건</span>
			<span aria-hidden="true"><FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} /></span>
			<span class="sr-only">{open ? '접기' : '펼치기'}</span>
		</button>
		{#if open}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (A focusable separator is an interactive ARIA window splitter.) -->
			<div
				role="separator"
				aria-label="Search Timing 패널 너비"
				aria-orientation="vertical"
				aria-controls="search-timing-dock-content"
				aria-valuemin={minWidth}
				aria-valuemax={widthLimit}
				aria-valuenow={effectiveWidth}
				aria-valuetext={`${effectiveWidth} 픽셀`}
				tabindex={ready ? 0 : -1}
				class="lc-timing-resize absolute top-10 bottom-0 -left-2 z-20 hidden w-4 cursor-col-resize touch-none select-none focus-visible:outline-2 focus-visible:outline-(--lc-text-accent) sm:block"
				class:is-dragging={Boolean(drag)}
				data-testid="search-timing-resize"
				onpointerdown={startResize}
				onpointermove={moveResize}
				onpointerup={endResize}
				onpointercancel={endResize}
				onlostpointercapture={endResize}
				onkeydown={resizeWithKeyboard}
			></div>
			<div
				id="search-timing-dock-content"
				bind:this={dockContent}
				class="lc-timing-dock-content min-h-0 w-full min-w-0 overflow-y-auto overscroll-contain rounded-lg"
			>
				{#snippet toolbar()}
					<div class="grid min-w-0 gap-2 border-b border-(--lc-border-soft) px-3 py-2 text-xs">
						<label class="min-w-0">
							<span class="lc-text-secondary mb-1 block font-semibold">요청 기록</span>
							<select
								bind:value={selectedId}
								bind:this={historySelect}
								onchange={restoreHistoryFocus}
								data-testid="search-timing-history"
								disabled={!ready}
								class="lc-text-primary min-h-9 w-full rounded-md border border-(--lc-control-border) bg-(--lc-surface-primary) px-2 py-1"
							>
								<option value="">최신 요청 자동 선택</option>
								{#each records as record, index (record.traceId)}
									<option value={record.traceId}>
										{index + 1}. {record.query.slice(0, 42)} · {record.sveltekitMs.toFixed(2)} ms
									</option>
								{/each}
							</select>
						</label>
						<div class="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
							<button
								type="button"
								class="lc-text-muted min-h-8 cursor-pointer px-2 underline-offset-2 hover:underline"
								data-testid="search-timing-clear"
								disabled={!ready}
								onclick={clearHistory}>기록 지우기</button
							>
							{#if hasBaseline}
								<button
									type="button"
									bind:this={compareButton}
									class="lc-button-neutral min-h-8 cursor-pointer rounded-md border px-2 font-semibold"
									class:lc-text-accent={comparing}
									data-testid="search-timing-compare-toggle"
									aria-pressed={comparing}
									onclick={toggleComparison}
									>{comparing ? '선택한 요청만 보기' : '최신 요청과 비교'}</button
								>
							{/if}
						</div>
					</div>
				{/snippet}
				{#if comparing && hasBaseline && latest}
					<SearchTimingComparison baseline={selected} {latest} {toolbar} />
				{:else}
					<SearchTiming timing={selected} {toolbar} />
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.lc-timing-resize::after {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 3px;
		height: 2rem;
		transform: translate(-50%, -50%);
		border-radius: 9999px;
		background: var(--lc-border-strong);
		content: '';
	}

	.lc-timing-resize:is(:hover, :focus-visible, .is-dragging)::after {
		background: var(--lc-text-accent);
	}

	.lc-timing-dock-content {
		box-shadow: 0 3px 16px color-mix(in srgb, var(--lc-text-primary) 8%, transparent);
	}

	@media (min-width: 80rem) {
		:global(body:has([data-search-timing-open]) [data-testid='app-route-container'] #main-content) {
			--lc-timing-space: calc(var(--lc-search-timing-width, 432px) + 1rem);
			width: calc(100% - var(--lc-timing-space));
			inset-inline-end: calc(var(--lc-timing-space) / 2);
		}
	}
</style>
