<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
	import type { AdminNoticeCard } from '$lib/types/api';

	// Receives the cap-1 card view (id + title) from the layout loader.
	let { notice }: { notice: AdminNoticeCard } = $props();
</script>

<!--
	Site-wide urgent banner: shown under the top navigation on every page when a
	Notion 긴급 notice exists — the layout loader passes the first urgent row in
	display order as a single notice. The alert role makes screen readers
	announce the urgent notice on arrival.
-->
<div
	role="alert"
	class="lc-urgent-banner border-b"
	data-testid="urgent-notice-banner"
	aria-label="긴급 공지"
>
	<a
		href={`/announcements/${notice.id}`}
		class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6"
		data-testid="urgent-notice-link"
	>
		<span class="lc-urgent-badge shrink-0">긴급</span>
		<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4 shrink-0" />
		<span class="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">{notice.title}</span>
		<span class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold opacity-90">
			<span class="hidden sm:inline">자세히 보기</span>
			<FontAwesomeIcon icon={faChevronRight} class="h-3 w-3" />
		</span>
	</a>
</div>
