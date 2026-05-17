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

	export let type: 'error' | 'success' | 'warning' | 'info' = 'info';
	export let message: string;
	export let dismissible: boolean = true;
	export let showRefresh: boolean = false;
	export let onDismiss: (() => void) | undefined = undefined;
	export let onRefresh: (() => void) | undefined = undefined;
	export let customAction: { label: string; handler: () => void } | undefined = undefined;
	export let autoHide: boolean = false;
	export let autoHideDelay: number = 5000;
	let visible = true;
	let autoHideTimer: NodeJS.Timeout | undefined;

	const typeConfig = {
		error: {
			icon: faTriangleExclamation,
			containerClass: 'border-red-200/60 bg-gradient-to-r from-red-50 to-rose-50',
			iconClass: 'text-red-500',
			textClass: 'text-red-700',
			buttonClass: 'text-red-600 hover:text-red-800',
			customButtonClass: 'bg-red-100 hover:bg-red-200 text-red-700'
		},
		success: {
			icon: faCircleCheck,
			containerClass: 'border-green-200/60 bg-gradient-to-r from-green-50 to-emerald-50',
			iconClass: 'text-green-500',
			textClass: 'text-green-700',
			buttonClass: 'text-green-600 hover:text-green-800',
			customButtonClass: 'bg-green-100 hover:bg-green-200 text-green-700'
		},
		warning: {
			icon: faTriangleExclamation,
			containerClass: 'border-yellow-200/60 bg-gradient-to-r from-yellow-50 to-amber-50',
			iconClass: 'text-yellow-500',
			textClass: 'text-yellow-700',
			buttonClass: 'text-yellow-600 hover:text-yellow-800',
			customButtonClass: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
		},
		info: {
			icon: faInfo,
			containerClass: 'border-blue-200/60 bg-gradient-to-r from-blue-50 to-indigo-50',
			iconClass: 'text-blue-500',
			textClass: 'text-blue-700',
			buttonClass: 'text-blue-600 hover:text-blue-800',
			customButtonClass: 'bg-blue-100 hover:bg-blue-200 text-blue-700'
		}
	};

	$: config = typeConfig[type];

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
		class="rounded-xl border {config.containerClass} mb-6 p-4 shadow-sm transition-all duration-300 ease-out"
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
						on:click={handleRefresh}
						class="flex cursor-pointer items-center space-x-1 text-sm {config.buttonClass} underline"
						title="페이지 새로고침"
					>
						<FontAwesomeIcon icon={faRefresh} class="h-3 w-3" />
						<span>새로고침</span>
					</button>
				{/if}

				{#if customAction}
					<button
						on:click={handleCustomAction}
						class="rounded-lg px-3 py-1.5 text-sm font-semibold {config.customButtonClass} cursor-pointer shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
					>
						{customAction.label}
					</button>
				{/if}

				{#if dismissible}
					<button
						on:click={handleDismiss}
						class="rounded-full p-1 {config.buttonClass} cursor-pointer transition-all duration-200 hover:scale-110 hover:bg-black/5 focus:ring-2 focus:ring-offset-2 focus:outline-none"
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
