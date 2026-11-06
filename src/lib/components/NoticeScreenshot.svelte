<script lang="ts">
	import LoadingSpinner from '#lib/components/LoadingSpinner.svelte';

	let {
		src,
		noticeNum,
		imageWidth,
		frameless = false,
		onLoad
	}: {
		src: string;
		noticeNum: number;
		imageWidth?: number;
		frameless?: boolean;
		onLoad?: (size: { width: number; height: number }) => void;
	} = $props();
	let status = $state<'loading' | 'loaded' | 'error'>('loading');
	let attempt = $state(0);

	// A fresh URL avoids reusing a cached failed image response in Firefox.
	function retry() {
		status = 'loading';
		attempt += 1;
	}
</script>

<div
	class:p-3={!frameless}
	style:width={imageWidth === undefined ? undefined : `${imageWidth + 2}px`}
	data-testid="notice-detail-screenshot-preview"
	aria-busy={status === 'loading'}
>
	{#if status === 'loading'}
		<div role="status" data-testid="notice-detail-screenshot-loading">
			<LoadingSpinner message="스크린샷을 불러오는 중입니다..." />
		</div>
	{:else if status === 'error'}
		<div
			class="flex min-h-48 flex-col items-center justify-center gap-3 text-center"
			role="alert"
			data-testid="notice-detail-screenshot-error"
		>
			<p class="lc-text-secondary text-sm">스크린샷을 불러오지 못했습니다. 다시 시도해 주세요.</p>
			<button
				type="button"
				onclick={retry}
				data-testid="notice-detail-screenshot-retry"
				class="lc-button-neutral cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold"
			>
				다시 시도
			</button>
		</div>
	{/if}
	{#key attempt}
		<img
			src={attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`}
			alt="의안번호 {noticeNum} 국회 입법예고 페이지 스크린샷"
			data-testid="notice-detail-screenshot-image"
			class="w-full rounded-lg border border-[var(--lc-border-soft)] shadow-sm"
			class:hidden={status !== 'loaded'}
			class:lc-screenshot-scaled={imageWidth !== undefined}
			style:width={imageWidth === undefined ? undefined : `${imageWidth}px`}
			draggable={frameless ? false : undefined}
			loading="eager"
			onload={(event) => {
				status = 'loaded';
				const image = event.currentTarget as HTMLImageElement;
				onLoad?.({
					width: image.naturalWidth,
					height: image.naturalHeight
				});
			}}
			onerror={() => (status = 'error')}
		/>
	{/key}
</div>

<style>
	.lc-screenshot-scaled {
		max-width: none;
		height: auto;
		box-sizing: content-box;
	}
</style>
