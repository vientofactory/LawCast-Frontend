<script lang="ts">
	/**
	 * Shared SEO head block used by every route. Renders the single `<title>`
	 * from the page-specific text plus the `- LawCast` brand suffix, together
	 * with the canonical URL and the description/keywords/OG/Twitter tags, so
	 * routes cannot drift apart. `image` adds the share preview image on routes
	 * that generate one. Page-specific extras (JSON-LD, article times, noindex)
	 * stay in each route's own `<svelte:head>`.
	 */
	let {
		title,
		description,
		url,
		keywords,
		type = 'website',
		image
	}: {
		title: string;
		description: string;
		url: string;
		keywords: string;
		type?: 'website' | 'article';
		image?: string;
	} = $props();

	const fullTitle = $derived(`${title} - LawCast`);
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
	{#if image}
		<meta property="og:image" content={image} />
		<meta name="twitter:image" content={image} />
	{/if}
</svelte:head>
