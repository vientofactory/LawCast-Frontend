<script lang="ts">
	export let visible = false;
	export let message = '불러오는 중...';
	export let overlayRadiusClass = 'rounded-2xl';
</script>

{#if visible}
	<div
		class={`lc-loading-overlay pointer-events-none absolute inset-0 z-10 ${overlayRadiusClass}`}
	></div>
	<div
		class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
		role="status"
		aria-live="polite"
	>
		<div
			class="lc-panel-hero flex flex-col items-center gap-3 rounded-2xl border px-8 py-6 shadow-2xl backdrop-blur-sm"
		>
			<div class="relative flex items-center justify-center">
				<div class="lc-spinner-ring h-10 w-10 animate-spin rounded-full border-4"></div>
			</div>
			<p class="lc-text-secondary text-sm font-semibold">{message}</p>
		</div>
	</div>
{/if}
