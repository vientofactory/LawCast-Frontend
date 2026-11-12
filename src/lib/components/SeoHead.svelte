<script lang="ts">
	/**
	 * Shared SEO head block used by every route. Renders the single `<title>`
	 * from the page-specific text plus the `- LawCast` brand suffix, together
	 * with the canonical URL and the description/keywords/OG/Twitter tags, so
	 * routes cannot drift apart. The outlined brand image is the default;
	 * `image` overrides it for routes with a custom or dynamic share preview.
	 * Page-specific extras (JSON-LD, article times, noindex)
	 * stay in each route's own `<svelte:head>`.
	 */
	let {
		title,
		description,
		url,
		keywords,
		type = 'website',
		image,
		imageAlt
	}: {
		title: string;
		description: string;
		url: string;
		keywords: string;
		type?: 'website' | 'article';
		image?: string;
		imageAlt?: string;
	} = $props();

	const fullTitle = $derived(`${title} - LawCast`);
	const shareImage = $derived(image || new URL('/og/lawcast-blueprint.png', url).href);
	const shareImageAlt = $derived(
		imageAlt || (image ? fullTitle : 'LawCast 로고와 국회 입법예고 아카이브 문구')
	);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<link rel="canonical" href={url} />
	<meta name="description" content={description} />
	<meta name="keywords" content={keywords} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta property="og:image" content={shareImage} />
	<meta property="og:image:alt" content={shareImageAlt} />
	{#if !image}
		<meta property="og:image:type" content="image/png" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}
	<meta name="twitter:image" content={shareImage} />
	<meta name="twitter:image:alt" content={shareImageAlt} />
</svelte:head>
