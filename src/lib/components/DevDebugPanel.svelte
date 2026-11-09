<script lang="ts">
	import { faTerminal } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { Snippet } from 'svelte';

	interface Entry {
		label: string;
		value: string;
		testId?: string;
		wrap?: boolean;
	}

	let {
		title,
		entries,
		description,
		children,
		toolbar,
		testId,
		class: className = ''
	}: {
		title: string;
		entries: Entry[];
		description?: string;
		children?: Snippet;
		toolbar?: Snippet;
		testId?: string;
		class?: string;
	} = $props();
</script>

<aside
	class={[
		'lc-debug-panel lc-text-primary rounded-lg border border-(--lc-border-soft) bg-(--lc-surface-elevated) text-sm leading-[1.6]',
		className
	]}
	aria-label={title}
	data-testid={testId}
>
	<div class:sticky={toolbar} class="top-0 z-10 rounded-t-md bg-(--lc-surface-elevated)">
		<header
			class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-t-md border-b border-(--lc-border-soft) bg-(--lc-surface-inset) px-3 py-2"
		>
			<span class="lc-text-accent shrink-0" aria-hidden="true">
				<FontAwesomeIcon icon={faTerminal} />
			</span>
			<p class="min-w-0 flex-1 font-semibold">{title}</p>
			<abbr
				class="lc-chip-muted rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide no-underline"
				title="개발 환경 전용"
			>
				DEV
			</abbr>
		</header>
		{@render toolbar?.()}
	</div>
	<div class="px-3 py-2.5">
		<dl class="grid grid-cols-1 gap-1">
			{#each entries as entry (entry.label)}
				<div>
					<dt class="lc-text-secondary inline font-medium">{entry.label}:</dt>
					<dd
						class="ml-1 inline font-mono tabular-nums"
						class:break-all={entry.wrap}
						data-testid={entry.testId}
					>
						{entry.value}
					</dd>
				</div>
			{/each}
		</dl>
		{@render children?.()}
		{#if description}
			<p class="lc-text-muted mt-2 text-xs">{description}</p>
		{/if}
	</div>
</aside>

<style>
	.lc-debug-panel {
		border-inline-start: 2px solid var(--lc-text-accent);
	}
</style>
