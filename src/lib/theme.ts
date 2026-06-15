import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'lawcast-theme';
const DARK_THEME_COLOR = '#08111f';
const LIGHT_THEME_COLOR = '#3b82f6';

function isThemeMode(value: string | null): value is ThemeMode {
	return value === 'light' || value === 'dark';
}

function getSystemTheme(): ThemeMode {
	if (!browser) {
		return 'light';
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readInitialTheme(): ThemeMode {
	if (!browser) {
		return 'light';
	}

	const savedTheme = window.localStorage.getItem(STORAGE_KEY);
	if (isThemeMode(savedTheme)) {
		return savedTheme;
	}

	const datasetTheme = document.documentElement.dataset.theme ?? null;
	if (isThemeMode(datasetTheme)) {
		return datasetTheme;
	}

	return getSystemTheme();
}

function syncTheme(theme: ThemeMode) {
	if (!browser) {
		return;
	}

	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;

	const metaThemeColor = document.querySelector('meta[name="theme-color"]');
	metaThemeColor?.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

const initialTheme = readInitialTheme();
syncTheme(initialTheme);

const themeStore = writable<ThemeMode>(initialTheme);

if (browser) {
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	const handleSystemThemeChange = (event: MediaQueryListEvent) => {
		if (isThemeMode(window.localStorage.getItem(STORAGE_KEY))) {
			return;
		}

		const nextTheme = event.matches ? 'dark' : 'light';
		syncTheme(nextTheme);
		themeStore.set(nextTheme);
	};

	mediaQuery.addEventListener('change', handleSystemThemeChange);
}

export const theme = {
	subscribe: themeStore.subscribe,
	set(nextTheme: ThemeMode) {
		if (browser) {
			window.localStorage.setItem(STORAGE_KEY, nextTheme);
		}

		syncTheme(nextTheme);
		themeStore.set(nextTheme);
	},
	toggle() {
		const nextTheme = readInitialTheme() === 'dark' ? 'light' : 'dark';
		this.set(nextTheme);
	}
};
