import { getContext, setContext } from 'svelte';
import { apiClient } from '#lib/api/client.ts';
import { RealtimeRead, activateRealtimeRead, freshFetch } from './realtime-read.svelte.ts';
import type { AdminNoticeTopResponse } from '#lib/types/api.ts';

const KEY = Symbol('urgent-notice');
export function provideUrgentNotice() {
	const read = new RealtimeRead<AdminNoticeTopResponse>(
		(signal) => apiClient.getTopAdminNotice({ urgent: true }, freshFetch(signal)),
		'긴급 공지를 불러오지 못했습니다.'
	);
	setContext(KEY, read);
	activateRealtimeRead(read, 60000);
	return read;
}
export function useUrgentNotice() {
	return getContext<RealtimeRead<AdminNoticeTopResponse> | undefined>(KEY);
}
