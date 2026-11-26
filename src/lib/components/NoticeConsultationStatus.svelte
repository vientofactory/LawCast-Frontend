<script lang="ts">
	import { getNoticeConsultation, type ConsultationInput } from '#lib/utils/notice-consultation.ts';

	let { notice, testId }: { notice: ConsultationInput; testId: string } = $props();
	let status = $derived(getNoticeConsultation(notice));
</script>

<span
	class="inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold"
	class:lc-chip-success={status.kind === 'open'}
	class:lc-chip-warning={status.kind === 'pre_notice' || status.kind === 'scheduled'}
	class:lc-chip-muted={status.kind === 'ended' || status.kind === 'unknown'}
	data-testid={testId}
	data-consultation-state={status.kind}>{status.label}</span
>
