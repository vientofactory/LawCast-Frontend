<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faXmark } from '@fortawesome/free-solid-svg-icons';

	let {
		label = '닫기',
		disabled = false,
		testId = 'modal-close',
		onclick
	}: {
		label?: string;
		disabled?: boolean;
		testId?: string;
		onclick?: () => void;
	} = $props();
</script>

<button
	type="button"
	class="lc-modal-close lc-text-muted inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-[var(--lc-surface-hover)] hover:text-[var(--lc-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
	aria-label={label}
	title={label}
	data-testid={testId}
	{disabled}
	{onclick}
>
	<FontAwesomeIcon icon={faXmark} class="h-4 w-4" />
</button>
