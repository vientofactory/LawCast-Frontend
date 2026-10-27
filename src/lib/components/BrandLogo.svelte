<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class:compact class="lc-brand-logo" data-testid="brand-logo">
	<img src="/brand/logo-light.svg" alt="LawCast" width="259" height="64" class="lc-brand-light" />
	<img src="/brand/logo-dark.svg" alt="LawCast" width="259" height="64" class="lc-brand-dark" />
</span>

<style>
	.lc-brand-logo {
		display: inline-flex;
		flex-shrink: 0;
		vertical-align: middle;
	}

	img {
		width: auto;
		height: 2.5rem;
	}

	.compact img {
		height: 2rem;
	}

	.lc-brand-dark {
		display: none;
	}

	:global(html[data-theme='dark']) .lc-brand-light {
		display: none;
	}

	:global(html[data-theme='dark']) .lc-brand-dark {
		display: block;
	}
</style>
