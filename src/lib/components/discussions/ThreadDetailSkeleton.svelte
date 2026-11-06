<!-- Match the open discussion layout without exposing decorative placeholders to assistive tools. -->
<div class="space-y-4" aria-hidden="true" data-testid="discussion-thread-skeleton">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="lc-skeleton h-11 w-24"></div>
		<div class="flex flex-wrap gap-2">
			<div class="lc-skeleton h-11 w-11 sm:w-24"></div>
			<div class="lc-skeleton h-11 w-24"></div>
		</div>
	</div>
	<div
		class="border-b border-[var(--lc-border-soft)] pt-3 pb-6"
		data-testid="discussion-skeleton-heading"
	>
		<div class="lc-skeleton mb-3 h-5 w-16"></div>
		<div class="flex flex-wrap gap-2">
			<div class="lc-skeleton h-5 w-24"></div>
			<div class="lc-skeleton h-5 w-20"></div>
		</div>
		<div class="lc-skeleton mt-3 h-8 w-3/4 sm:h-9 sm:w-1/2"></div>
		<div class="lc-skeleton mt-3 h-5 w-40 max-w-full"></div>
	</div>
	<div class="space-y-3">
		{#each [0, 1] as index (index)}
			<div
				class="lc-content-card rounded-xl border border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] p-4"
			>
				<div
					class="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--lc-border-soft)] pb-3"
				>
					<div class="flex flex-wrap items-center gap-2">
						<div class="lc-skeleton h-5 w-8"></div>
						<div class="lc-skeleton h-4 w-16"></div>
						<div class="lc-skeleton h-4 w-24"></div>
					</div>
					<div class="lc-skeleton h-8 w-32 max-w-full"></div>
				</div>
				<div class="lc-skeleton h-5 w-full"></div>
				<div class="lc-skeleton mt-2 h-5 w-3/4"></div>
			</div>
		{/each}
	</div>
	<div class="min-h-8"></div>
	<div class="lc-skeleton-composer" data-testid="discussion-skeleton-composer">
		<div class="lc-skeleton h-7 w-32"></div>
		<div class="lc-skeleton mt-2 h-5 w-3/4"></div>
		<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each [0, 1] as index (index)}
				<div>
					<div class="lc-skeleton mb-2 h-5 w-40 max-w-full"></div>
					<div class="lc-skeleton h-12 w-full"></div>
				</div>
			{/each}
		</div>
		<div class="lc-skeleton mt-5 mb-2 h-5 w-20"></div>
		<div class="lc-skeleton h-36 w-full"></div>
		<div class="mt-2 flex flex-wrap justify-between gap-2">
			<div class="lc-skeleton h-5 w-3/4"></div>
			<div class="lc-skeleton ml-auto h-5 w-16"></div>
		</div>
		<div class="lc-skeleton mt-5 ml-auto h-11 w-full sm:w-36"></div>
	</div>
</div>

<style>
	.lc-skeleton {
		max-width: 100%;
		border-radius: 0.375rem;
		background: var(--lc-border-soft);
		animation: lc-skeleton-pulse 2s ease-in-out infinite;
	}
	.lc-skeleton-composer {
		margin-top: 2rem;
		padding: clamp(1rem, 2.5vw, 1.5rem);
		background: var(--lc-surface-muted);
		border-top: 1px solid var(--lc-border-soft);
	}
	@keyframes lc-skeleton-pulse {
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lc-skeleton {
			animation: none;
		}
	}
</style>
