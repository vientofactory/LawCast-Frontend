<script lang="ts">
	import Alert from './Alert.svelte';
	let {
		message,
		id,
		revision = 0,
		testId
	}: {
		message: string;
		id: string;
		revision?: number;
		testId?: string;
	} = $props();
	let showNotification = $state(false);
	$effect(() => {
		void revision;
		showNotification = Boolean(message);
	});
</script>

{#if message}
	<!-- The toast announces the error; the persistent description remains available to fields. -->
	<p {id} class="mb-3 text-sm leading-relaxed" style:color="var(--lc-status-error)">{message}</p>
	{#if showNotification}
		<Alert type="error" {message} {testId} onDismiss={() => (showNotification = false)} />
	{/if}
{/if}
