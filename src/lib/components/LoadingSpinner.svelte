<script lang="ts">
	import { Loader2 } from 'lucide-svelte';

	export let message: string = '데이터를 불러오는 중...';
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-8 w-8',
		lg: 'h-12 w-12'
	};
</script>

<div class="flex items-center justify-center py-16">
	<div class="text-center">
		<Loader2 class="mx-auto mb-4 {sizeClasses[size]} animate-spin text-blue-600" />
		<p class="text-gray-600">{message}</p>
	</div>
</div>
