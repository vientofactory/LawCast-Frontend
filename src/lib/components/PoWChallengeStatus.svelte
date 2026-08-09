<script lang="ts">
	import { formatPowHashRate, formatPowRemainingTime } from '$lib/utils/pow-status';

	export let message = '';
	export let estimatedRemainingMs: number | null = null;
	export let hashRate: number | null = null;
	export let difficultyBits: number | null = null;
	export let messageSpacingClass = '';
	export let metricsSpacingClass = '';
</script>

<p class={`lc-text-muted animate-pulse text-center text-xs ${messageSpacingClass}`.trim()}>
	{message || '잠시만 기다려주세요. 페이지를 새로고침하면 처음부터 다시 시작해야 합니다.'}
</p>
{#if estimatedRemainingMs !== null || hashRate !== null || difficultyBits !== null}
	<div
		class={`lc-text-dim flex items-center justify-center gap-2 text-[11px] ${metricsSpacingClass}`.trim()}
	>
		{#if estimatedRemainingMs !== null}
			<span class="lc-text-accent font-medium">{formatPowRemainingTime(estimatedRemainingMs)}</span>
			<span>·</span>
		{/if}
		{#if hashRate !== null}
			<span>{formatPowHashRate(hashRate)}</span>
		{/if}
		{#if difficultyBits !== null}
			{#if hashRate !== null}<span>·</span>{/if}
			<span>난이도 {difficultyBits}bit</span>
		{/if}
	</div>
{/if}
