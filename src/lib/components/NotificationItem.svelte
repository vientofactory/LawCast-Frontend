<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { reducedModalMotion } from '$lib/utils/modal-motion';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCircleCheck,
		faCircleInfo,
		faTriangleExclamation,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import { NOTIFICATION_DURATION, type NotificationEntry } from '$lib/utils/notifications';
	let { entry, onDismiss }: { entry: NotificationEntry; onDismiss: () => void } = $props();
	let card = $state<HTMLElement>();
	let hovered = $state(false);
	let focused = $state(false);
	let hidden = $state(false);
	let ready = $state(false);
	let remaining = untrack(() => entry.duration ?? NOTIFICATION_DURATION[entry.type]);
	const labels = { success: '완료', warning: '주의', error: '오류', info: '안내' };

	onMount(() => {
		const visibility = () => (hidden = document.hidden || !!card?.closest('[inert]'));
		const observer = new MutationObserver(visibility);
		observer.observe(document.body, {
			subtree: true,
			attributes: true,
			attributeFilter: ['inert']
		});
		visibility();
		ready = true;
		document.addEventListener('visibilitychange', visibility);
		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', visibility);
		};
	});
	$effect(() => {
		if (!ready || hovered || focused || hidden || remaining <= 0) return;
		const started = Date.now();
		const timer = setTimeout(onDismiss, remaining);
		return () => {
			clearTimeout(timer);
			remaining = Math.max(1, remaining - (Date.now() - started));
		};
	});
	function dismiss() {
		if (card?.contains(document.activeElement)) {
			const next = card.nextElementSibling?.querySelector<HTMLElement>('button');
			const target = next ?? entry.origin;
			if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
		}
		onDismiss();
	}
</script>

<section
	bind:this={card}
	class="lc-notification"
	data-testid={entry.testId ?? 'notification'}
	data-notification-type={entry.type}
	role={entry.type === 'error' ? 'alert' : 'status'}
	aria-atomic="true"
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
	onfocusin={() => (focused = true)}
	onfocusout={(event) => (focused = card?.contains(event.relatedTarget as Node) ?? false)}
	in:fly={{ y: 12, duration: reducedModalMotion() ? 0 : 160 }}
	out:fly={{ y: 8, duration: reducedModalMotion() ? 0 : 100 }}
>
	<FontAwesomeIcon
		icon={entry.type === 'success'
			? faCircleCheck
			: entry.type === 'info'
				? faCircleInfo
				: faTriangleExclamation}
		class="lc-notification-icon"
	/>
	<div class="lc-notification-content">
		<p class="lc-text-primary text-sm font-bold">{labels[entry.type]}</p>
		{#if entry.message}<p class="lc-text-secondary mt-1 text-sm leading-relaxed">
				{entry.message}
			</p>{/if}
		{#if entry.content}{@render entry.content()}{/if}
		{#if entry.action}
			<button
				type="button"
				class="lc-button-neutral mt-2 min-h-11 rounded-lg border px-3 text-sm font-semibold"
				onclick={() => entry.action?.handler()}>{entry.action.label}</button
			>
		{/if}
	</div>
	<button
		type="button"
		class="lc-button-neutral lc-notification-close"
		aria-label="알림 닫기"
		onclick={dismiss}><FontAwesomeIcon icon={faXmark} class="h-4 w-4" /></button
	>
</section>

<style>
	.lc-notification {
		--notification-color: var(--lc-text-accent);
	}
	.lc-notification[data-notification-type='success'] {
		--notification-color: #15803d;
	}
	.lc-notification[data-notification-type='warning'] {
		--notification-color: #b45309;
	}
	.lc-notification[data-notification-type='error'] {
		--notification-color: #b91c1c;
	}
	:global(html[data-theme='dark']) .lc-notification[data-notification-type='success'] {
		--notification-color: #bfe8d1;
	}
	:global(html[data-theme='dark']) .lc-notification[data-notification-type='warning'] {
		--notification-color: #fde68a;
	}
	:global(html[data-theme='dark']) .lc-notification[data-notification-type='error'] {
		--notification-color: #fca5a5;
	}
	.lc-notification {
		pointer-events: auto;
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 0.75rem;
		border: 1px solid var(--lc-border-soft);
		border-inline-start: 4px solid var(--notification-color);
		border-radius: 0.5rem;
		background: var(--lc-surface-elevated);
		box-shadow: var(--lc-shadow-soft);
	}
	:global(.lc-notification-icon) {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 0.25rem;
		color: var(--notification-color);
	}
	.lc-notification-content {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.lc-notification-close {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		border-radius: 0.5rem;
		cursor: pointer;
	}
</style>
