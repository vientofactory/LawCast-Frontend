<script lang="ts">
	import { onMount } from 'svelte';
	import { useNotifications } from '#lib/utils/notifications.ts';
	import NotificationItem from './NotificationItem.svelte';
	let { scope = 'page' }: { scope?: string } = $props();
	let keyboardInset = $state(0);
	onMount(() => {
		const view = window.visualViewport;
		const resize = () =>
			(keyboardInset = view ? Math.max(0, window.innerHeight - view.height - view.offsetTop) : 0);
		resize();
		view?.addEventListener('resize', resize);
		view?.addEventListener('scroll', resize);
		return () => {
			view?.removeEventListener('resize', resize);
			view?.removeEventListener('scroll', resize);
		};
	});
	const center = useNotifications();
	const entries = center.entries;
	let pending = $derived($entries.filter((entry) => entry.scope === scope));
</script>

<div
	class="lc-notification-viewport"
	style:--lc-notification-keyboard-inset={`${keyboardInset}px`}
	data-testid="notification-viewport"
	data-notification-scope-host={scope}
	class:empty={pending.length === 0}
	role="region"
	aria-label="알림"
>
	{#each pending.slice(0, 3) as entry (entry.id)}
		<NotificationItem {entry} onDismiss={() => center.remove(entry.id, true)} />
	{/each}
	{#if pending.length > 3}<p
			class="lc-panel-card rounded-lg border px-3 py-2 text-center text-xs"
			role="status"
		>
			대기 중인 알림 {pending.length - 3}개
		</p>{/if}
</div>

<style>
	.lc-notification-viewport[data-notification-scope-host='page'] {
		--lc-notification-obstacle: max(
			var(--lc-consent-banner-height, 0px),
			var(--lc-install-prompt-space, 0px)
		);
	}
	.lc-notification-viewport.empty {
		display: none;
	}
	.lc-notification-viewport {
		position: fixed;
		z-index: 11000;
		inset-inline-end: max(1rem, env(safe-area-inset-right));
		--lc-notification-bottom: max(
			1rem,
			env(safe-area-inset-bottom),
			calc(var(--lc-notification-keyboard-inset, 0px) + 1rem),
			calc(var(--lc-notification-obstacle, 0px) + 0.75rem)
		);
		bottom: var(--lc-notification-bottom);
		width: min(26rem, calc(100vw - 2rem));
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: calc(100dvh - var(--lc-notification-bottom) - max(1rem, env(safe-area-inset-top)));
		overflow-y: auto;
		overscroll-behavior: contain;
		pointer-events: none;
	}
</style>
