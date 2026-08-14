<script lang="ts">
	import { faSpinner } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	export let message: string = '데이터를 불러오는 중...';
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-8 w-8',
		lg: 'h-12 w-12'
	};
</script>

<div class="flex items-center justify-center py-16" style="border-radius: 9999px;">
	<div class="text-center" style="border-radius: 9999px;">
		<FontAwesomeIcon
			icon={faSpinner}
			class="lc-text-accent mx-auto mb-4 {sizeClasses[size]} animate-spin"
			style="border-radius: 9999px;"
		/>
		<p class="lc-text-secondary">{message}</p>
	</div>
</div>
