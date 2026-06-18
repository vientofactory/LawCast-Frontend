<script lang="ts">
	import '../app.css';
	import 'nprogress/nprogress.css';
	import Footer from '$lib/components/Footer.svelte';
	import NProgress from 'nprogress';
	import { navigating } from '$app/state';
	import '@fortawesome/fontawesome-svg-core/styles.css';
	import { config } from '@fortawesome/fontawesome-svg-core';

	config.autoAddCss = false;

	NProgress.configure({ showSpinner: false });

	$effect(() => {
		if (navigating.to) {
			NProgress.start();
		} else {
			NProgress.done();
		}
	});

	let { children } = $props();
</script>

<svelte:head>
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta property="og:site_name" content="LawCast" />
	<meta property="og:locale" content="ko_KR" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-[var(--lc-surface-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--lc-text-accent)] focus:shadow-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
>
	메인 콘텐츠로 건너뛰기
</a>
{@render children()}
<Footer />
