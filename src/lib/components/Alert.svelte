<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { useNotifications, type NotificationType } from '#lib/utils/notifications.ts';
	let {
		type = 'info',
		message = '',
		onDismiss,
		onRefresh,
		showRefresh = false,
		customAction,
		autoHide = true,
		autoHideDelay,
		testId,
		children
	}: {
		type?: NotificationType;
		message?: string;
		showRefresh?: boolean;
		onDismiss?: () => void;
		onRefresh?: () => void;
		customAction?: { label: string; handler: () => void };
		autoHide?: boolean;
		autoHideDelay?: number;
		testId?: string;
		children?: Snippet;
	} = $props();
	const center = useNotifications();
	let anchor = $state<HTMLSpanElement>();
	$effect(() => {
		if (!anchor || (!message && !children)) return;
		const input = {
			type,
			message,
			content: children,
			duration: autoHide ? autoHideDelay : 0,
			action:
				customAction ??
				(showRefresh && onRefresh ? { label: '새로고침', handler: onRefresh } : undefined),
			testId
		};
		const scope =
			anchor.closest('[data-notification-scope]')?.getAttribute('data-notification-scope') ??
			'page';
		const id = untrack(() =>
			center.push({
				...input,
				scope,
				onDismiss,
				origin: document.activeElement as HTMLElement | null
			})
		);
		return () => center.remove(id);
	});
</script>

<span bind:this={anchor} hidden aria-hidden="true"></span>
