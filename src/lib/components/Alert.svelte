<script lang="ts">
	import {
		faCircleCheck,
		faInfo,
		faRefresh,
		faTriangleExclamation,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { onMount } from 'svelte';

	let {
		type = 'info',
		message,
		dismissible = true,
		showRefresh = false,
		onDismiss,
		onRefresh,
		customAction,
		autoHide = false,
		autoHideDelay = 5000
	}: {
		type?: 'error' | 'success' | 'warning' | 'info';
		message: string;
		dismissible?: boolean;
		showRefresh?: boolean;
		onDismiss?: () => void;
		onRefresh?: () => void;
		customAction?: { label: string; handler: () => void };
		autoHide?: boolean;
		autoHideDelay?: number;
	} = $props();
	let visible = $state(true);
	let autoHideTimer: NodeJS.Timeout | undefined;

	const typeConfig = {
		error: {
			icon: faTriangleExclamation,
			containerClass: 'lc-alert-error',
			iconClass: 'lc-text-danger',
			textClass: 'lc-text-danger',
			buttonClass: 'lc-text-danger',
			customButtonClass: 'lc-alert-action lc-alert-action-error'
		},
		success: {
			icon: faCircleCheck,
			containerClass: 'lc-alert-success',
			iconClass: 'lc-text-success',
			textClass: 'lc-text-success',
			buttonClass: 'lc-text-success',
			customButtonClass: 'lc-alert-action lc-alert-action-success'
		},
		warning: {
			icon: faTriangleExclamation,
			containerClass: 'lc-alert-warning',
			iconClass: 'lc-text-warning',
			textClass: 'lc-text-warning',
			buttonClass: 'lc-text-warning',
			customButtonClass: 'lc-alert-action lc-alert-action-warning'
		},
		info: {
			icon: faInfo,
			containerClass: 'lc-alert-info',
			iconClass: 'lc-text-accent',
			textClass: 'lc-text-accent',
			buttonClass: 'lc-text-accent',
			customButtonClass: 'lc-alert-action lc-alert-action-info'
		}
	};

	let config = $derived(typeConfig[type]);

	// Setup auto hide functionality on mount
	onMount(() => {
		if (autoHide && type === 'success') {
			autoHideTimer = setTimeout(() => {
				if (visible) {
					handleDismiss();
				}
			}, autoHideDelay);
		}

		// Cleanup timer on component destroy
		return () => {
			if (autoHideTimer) {
				clearTimeout(autoHideTimer);
			}
		};
	});

	function handleDismiss() {
		if (autoHideTimer) {
			clearTimeout(autoHideTimer);
		}

		visible = false;
		setTimeout(() => {
			onDismiss?.();
		}, 200); // Wait for animation to complete
	}

	function handleRefresh() {
		onRefresh?.();
	}

	function handleCustomAction() {
		customAction?.handler();
	}
</script>

{#if visible}
	<div
		class="lc-alert {config.containerClass} mb-6 rounded-xl border p-4 shadow-sm transition-all duration-300 ease-out"
		class:animate-fade-in={visible}
		class:opacity-0={!visible}
		class:transform={true}
		class:translate-x-0={visible}
		class:translate-x-full={!visible}
		role="alert"
		aria-live="polite"
	>
		<div class="flex items-center justify-between">
			<div class="flex items-center">
				<FontAwesomeIcon icon={config.icon} class="mr-3 h-5 w-5 {config.iconClass} shrink-0" />
				<span class="{config.textClass} leading-relaxed font-medium">{message}</span>
			</div>

			<div class="ml-4 flex items-center space-x-2">
				{#if showRefresh}
					<button
						onclick={handleRefresh}
						class="flex cursor-pointer items-center space-x-1 text-sm {config.buttonClass}"
						title="페이지 새로고침"
					>
						<FontAwesomeIcon icon={faRefresh} class="h-3 w-3" />
						<span>새로고침</span>
					</button>
				{/if}

				{#if customAction}
					<button
						onclick={handleCustomAction}
						class="rounded-lg px-3 py-1.5 text-sm font-semibold {config.customButtonClass} cursor-pointer shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
					>
						{customAction.label}
					</button>
				{/if}

				{#if dismissible}
					<button
						onclick={handleDismiss}
						class="lc-hover-subtle-bg rounded-full p-1 {config.buttonClass} cursor-pointer transition-all duration-200 hover:scale-110 focus:ring-2 focus:ring-offset-2 focus:outline-none"
						aria-label="알림 닫기"
						title="닫기"
					>
						<FontAwesomeIcon icon={faXmark} class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
