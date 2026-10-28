<script lang="ts">
	import OpenSignalLoader from './OpenSignalLoader.svelte';

	let {
		visible = false,
		message = '불러오는 중...',
		variant = 'spinner',
		overlayRadiusClass = 'rounded-2xl'
	}: {
		visible?: boolean;
		message?: string;
		variant?: 'spinner' | 'semantic';
		overlayRadiusClass?: string;
	} = $props();
</script>

{#if visible}
	<div
		class={`lc-loading-overlay absolute inset-0 z-10 ${overlayRadiusClass}`}
		aria-hidden="true"
	></div>
	<div class="fixed inset-0 z-50 flex items-center justify-center" role="status" aria-live="polite">
		<div
			class="lc-panel-hero lc-loading-shell flex max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] flex-col items-center gap-3 overflow-y-auto border px-8 py-6 shadow-2xl backdrop-blur-sm"
			style="border-radius: 1rem;"
		>
			{#if variant === 'semantic'}
				<OpenSignalLoader />
			{:else}
				<div class="relative flex items-center justify-center" style="border-radius: 1rem;">
					<div
						class="lc-spinner-ring h-10 w-10 animate-spin border-4"
						style="border-radius: 9999px;"
					></div>
				</div>
			{/if}
			<p class="lc-text-secondary text-sm font-semibold">{message}</p>
		</div>
	</div>
{/if}
