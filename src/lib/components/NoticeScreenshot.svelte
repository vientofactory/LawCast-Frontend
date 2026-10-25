<script lang="ts">
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	let { src, noticeNum }: { src: string; noticeNum: number } = $props();
	let status = $state<'loading' | 'loaded' | 'error'>('loading');
	let attempt = $state(0);

	function retry() {
		status = 'loading';
		attempt += 1;
	}
</script>

<div class="p-3" data-testid="notice-detail-screenshot-preview" aria-busy={status === 'loading'}>
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
			{src}
			alt="의안번호 {noticeNum} 국회 입법예고 페이지 스크린샷"
			data-testid="notice-detail-screenshot-image"
			class="w-full rounded-lg border border-[var(--lc-border-soft)] shadow-sm"
			class:hidden={status !== 'loaded'}
			loading="eager"
			onload={() => (status = 'loaded')}
			onerror={() => (status = 'error')}
		/>
	{/key}
</div>
