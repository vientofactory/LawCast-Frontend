<script lang="ts">
	import '../app.css';
	import 'nprogress/nprogress.css';
	import NProgress from 'nprogress';
	import { onMount } from 'svelte';
	import { navigating } from '$app/state';
	import '@fortawesome/fontawesome-svg-core/styles.css';
	import { config } from '@fortawesome/fontawesome-svg-core';
	import favicon from '$lib/assets/favicon.svg';
	import { warmupHashGuardWorker } from '$lib/hashguard-worker';

	config.autoAddCss = false;

	NProgress.configure({ showSpinner: false });

	$effect(() => {
		if (navigating.to) {
			NProgress.start();
		} else {
			NProgress.done();
		}
	});

	onMount(() => {
		void warmupHashGuardWorker();
	});

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta property="og:site_name" content="LawCast" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

{@render children()}
