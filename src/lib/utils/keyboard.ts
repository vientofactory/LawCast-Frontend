export function dismissTouchKeyboard(): void {
	if (!window.matchMedia('(pointer: coarse)').matches) return;
	const activeElement = document.activeElement;
	if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
		activeElement.blur();
	}
}
