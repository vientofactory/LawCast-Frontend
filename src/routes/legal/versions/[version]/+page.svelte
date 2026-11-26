<script lang="ts">
	import LegalNoticeDocument from '#lib/components/LegalNoticeDocument.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<LegalNoticeDocument {data} />
