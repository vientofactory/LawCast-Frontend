import { getContext, setContext, type Snippet } from 'svelte';
import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';
export interface NotificationInput {
	type: NotificationType;
	message: string;
	scope?: string;
	duration?: number;
	action?: { label: string; handler: () => void };
	onDismiss?: () => void;
	testId?: string;
	content?: Snippet;
	origin?: HTMLElement | null;
}
export interface NotificationEntry extends NotificationInput {
	id: number;
}
const KEY = Symbol('notifications');
export const NOTIFICATION_DURATION = { success: 5000, info: 6000, warning: 7000, error: 8000 };

export function createNotificationCenter() {
	const entries = writable<NotificationEntry[]>([]);
	let sequence = 0;
	return {
		entries,
		push(input: NotificationInput) {
			const id = ++sequence;
			entries.update((items) => [...items, { ...input, scope: input.scope ?? 'page', id }]);
			return id;
		},
		remove(id: number, dismissed = false) {
			let removed: NotificationEntry | undefined;
			entries.update((items) => {
				removed = items.find((item) => item.id === id);
				return items.filter((item) => item.id !== id);
			});
			if (dismissed) removed?.onDismiss?.();
		}
	};
}
export type NotificationCenter = ReturnType<typeof createNotificationCenter>;
export function provideNotifications() {
	const center = createNotificationCenter();
	setContext(KEY, center);
	return center;
}
export function useNotifications() {
	return getContext<NotificationCenter>(KEY);
}
