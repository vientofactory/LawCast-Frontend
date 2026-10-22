<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faXmark } from '@fortawesome/free-solid-svg-icons';
	import { semanticEngineHealth } from '$lib/api/client';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import type { SemanticEngineHealthResponse } from '$lib/types/api';

	/**
	 * Fixed corner control reporting the semantic engine's health (chunk index
	 * count, last index update, last refresh run). A small pill keeps it out of
	 * the way of casual readers while the details stay one click away.
	 *
	 * The widget owns the single health request. `health`, `loading` and `error`
	 * are bindable so a page that also gates its own UI on engine readiness (the
	 * semantic search page) can read this fetch instead of issuing a second one;
	 * `testIdPrefix` keeps each page's instance addressable from e2e specs.
	 */
	let {
		health = $bindable<SemanticEngineHealthResponse | null>(null),
		loading = $bindable(true),
		error = $bindable<string | null>(null),
		testIdPrefix = 'semantic-search-engine-status'
	}: {
		health?: SemanticEngineHealthResponse | null;
		loading?: boolean;
		error?: string | null;
		testIdPrefix?: string;
	} = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	let panelId = $derived(`${testIdPrefix}-panel`);
	// Green only for a fully ready engine: an in-flight status fetch, an engine
	// still loading, or a failed engine must never read as healthy.
	let dotClass = $derived(
		health?.status === 'ready'
			? 'lc-dot-success'
			: error || health?.status === 'failed'
				? 'lc-text-danger bg-current'
				: 'lc-dot-warning animate-pulse'
	);

	/**
	 * Load the engine status once per mount. A failure only affects this widget,
	 * never the page it sits on.
	 */
	async function loadHealth() {
		loading = true;
		error = null;
		try {
			health = await semanticEngineHealth();
		} catch (caught) {
			health = null;
			error = (caught as Error).message || '엔진 상태를 확인할 수 없습니다.';
		} finally {
			loading = false;
		}
	}

	/**
	 * Close the panel when a click lands outside it, so the widget behaves like a
	 * popover instead of a modal. Clicks on the widget itself (trigger, panel,
	 * close button) are ignored.
	 */
	function handleWindowClick(event: MouseEvent) {
		if (!open) return;
		const target = event.target;
		if (target instanceof Node && root?.contains(target)) return;
		open = false;
	}

	onMount(() => {
		void loadHealth();
	});
</script>

<svelte:window onclick={handleWindowClick} />

<div
	bind:this={root}
	class="fixed right-4 z-40 flex flex-col items-end gap-2"
	style="bottom: calc(var(--lc-consent-banner-height, 0px) + 1rem);"
	data-testid={testIdPrefix}
>
	{#if open}
		<div
			id={panelId}
			class="lc-panel-card w-72 rounded-xl border p-4 shadow-lg"
			role="dialog"
			aria-labelledby={`${testIdPrefix}-heading`}
			data-testid={`${testIdPrefix}-panel`}
			transition:fly={{ y: 8, duration: 180, opacity: 0 }}
		>
			<div class="flex items-center justify-between">
				<h2 id={`${testIdPrefix}-heading`} class="lc-text-primary text-sm font-semibold">
					엔진 상태
				</h2>
				<button
					type="button"
					class="lc-text-dim cursor-pointer rounded p-1 transition-opacity hover:opacity-70"
					aria-label="엔진 상태 닫기"
					data-testid={`${testIdPrefix}-close`}
					onclick={() => (open = false)}
				>
					<FontAwesomeIcon icon={faXmark} class="h-3.5 w-3.5" />
				</button>
			</div>
			{#if loading}
				<p
					class="lc-text-secondary mt-2 text-sm"
					role="status"
					aria-live="polite"
					data-testid={`${testIdPrefix}-loading`}
				>
					엔진 상태를 확인하는 중...
				</p>
			{:else if error}
				<p class="lc-text-danger mt-2 text-sm" data-testid={`${testIdPrefix}-error`}>
					{error}
				</p>
			{:else if health}
				<dl class="mt-2 flex flex-col gap-2 text-sm" data-testid={`${testIdPrefix}-values`}>
					<div>
						<dt class="lc-text-dim text-xs">청크 인덱스 개수</dt>
						<dd class="lc-text-primary font-semibold" data-testid={`${testIdPrefix}-chunks`}>
							{health.indexedChunks.toLocaleString('ko-KR')}
						</dd>
					</div>
					<div>
						<dt class="lc-text-dim text-xs">마지막 업데이트</dt>
						<dd class="lc-text-primary" data-testid={`${testIdPrefix}-last-update`}>
							{health.lastUpdateAt ? formatDateTimeKST(health.lastUpdateAt) : '기록 없음'}
						</dd>
					</div>
					<div>
						<dt class="lc-text-dim text-xs">마지막 업데이트 실행 시간</dt>
						<dd class="lc-text-primary" data-testid={`${testIdPrefix}-last-update-run`}>
							{health.lastUpdateTriggeredAt
								? formatDateTimeKST(health.lastUpdateTriggeredAt)
								: '기록 없음'}
						</dd>
					</div>
				</dl>
			{/if}
		</div>
	{/if}
	<button
		type="button"
		class="lc-panel-card flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm opacity-70 transition-all duration-200 hover:-translate-y-0.5 hover:opacity-100"
		aria-expanded={open}
		aria-controls={open ? panelId : undefined}
		data-testid={`${testIdPrefix}-trigger`}
		onclick={() => (open = !open)}
	>
		<span
			class={`h-1.5 w-1.5 rounded-full ${dotClass}`}
			data-testid={`${testIdPrefix}-dot`}
			aria-hidden="true"
		></span>
		<span class="lc-text-secondary">엔진 상태</span>
	</button>
</div>
