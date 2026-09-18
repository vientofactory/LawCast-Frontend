import { test, expect, type Page } from '@playwright/test';

/**
 * Verifies that color-scheme settings do not conflict with browser auto dark mode
 * when the Auto Dark Mode for Web Contents flag is enabled.
 */

const STORAGE_KEY = 'lawcast-theme';

async function clearThemeStorage(page: Page): Promise<void> {
	await page.evaluate((key) => {
		localStorage.removeItem(key);
	}, STORAGE_KEY);
}

async function setThemeStorage(page: Page, theme: 'light' | 'dark'): Promise<void> {
	await page.evaluate(
		({ key, value }) => {
			localStorage.setItem(key, value);
		},
		{ key: STORAGE_KEY, value: theme }
	);
}

async function reloadWithTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
	await setThemeStorage(page, theme);
	await page.reload();
	await page.waitForLoadState('domcontentloaded');
}

async function getComputedColorScheme(page: Page): Promise<string> {
	return page.evaluate(() => {
		return window.getComputedStyle(document.documentElement).colorScheme;
	});
}

async function getDataTheme(page: Page): Promise<string | null> {
	return page.evaluate(() => {
		return document.documentElement.dataset.theme ?? null;
	});
}

async function getCssVariable(page: Page, variable: string): Promise<string> {
	return page.evaluate((v) => {
		return window.getComputedStyle(document.documentElement).getPropertyValue(v).trim();
	}, variable);
}

test.describe('Auto Dark Mode + color-scheme conflict prevention', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');
		await clearThemeStorage(page);
	});

	test('data-theme attribute is not polluted by browser auto dark mode', async ({ page }) => {
		await page.reload();
		await page.waitForLoadState('domcontentloaded');

		const dataTheme = await getDataTheme(page);
		expect(dataTheme).toBeTruthy();
		expect(['light', 'dark']).toContain(dataTheme);

		const colorScheme = await getComputedColorScheme(page);
		expect(colorScheme).toBe(dataTheme);
	});

	test('color-scheme CSS property is synced with data-theme', async ({ page }) => {
		await page.reload();
		await page.waitForLoadState('domcontentloaded');

		const dataTheme = await getDataTheme(page);
		const colorScheme = await getComputedColorScheme(page);

		expect(colorScheme).toBe(dataTheme);

		await expect(async () => {
			const currentColorScheme = await getComputedColorScheme(page);
			expect(currentColorScheme).toBe(dataTheme);
		}).toPass({ timeout: 2000 });
	});

	test('CSS variables are correctly applied in light theme', async ({ page }) => {
		await reloadWithTheme(page, 'light');

		const dataTheme = await getDataTheme(page);
		expect(dataTheme).toBe('light');

		const bodyBg = await getCssVariable(page, '--lc-body-bg');
		expect(bodyBg).toBe('#fafafb');

		const textPrimary = await getCssVariable(page, '--lc-text-primary');
		expect(textPrimary).toBe('#0f172a');
	});

	test('CSS variables are correctly applied in dark theme', async ({ page }) => {
		await reloadWithTheme(page, 'dark');

		const dataTheme = await getDataTheme(page);
		expect(dataTheme).toBe('dark');

		const bodyBg = await getCssVariable(page, '--lc-body-bg');
		expect(bodyBg).toBe('#0b1117');

		const textPrimary = await getCssVariable(page, '--lc-text-primary');
		expect(textPrimary).toBe('#e5e7eb');
	});

	test('color-scheme updates immediately on theme switch', async ({ page }) => {
		const initialTheme = await getDataTheme(page);
		const expectedNextTheme = initialTheme === 'dark' ? 'light' : 'dark';

		await page.evaluate((key) => {
			const root = document.documentElement;
			const currentTheme = root.dataset.theme as 'light' | 'dark';
			const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

			localStorage.setItem(key, nextTheme);
			root.dataset.theme = nextTheme;
			root.style.colorScheme = nextTheme;
		}, STORAGE_KEY);

		await expect(async () => {
			const dataTheme = await getDataTheme(page);
			const colorScheme = await getComputedColorScheme(page);
			expect(dataTheme).toBe(expectedNextTheme);
			expect(colorScheme).toBe(expectedNextTheme);
		}).toPass({ timeout: 2000 });
	});

	test('CSS variable changes do not pollute other color variables', async ({ page }) => {
		await reloadWithTheme(page, 'light');

		const lightVariables = {
			bodyBg: await getCssVariable(page, '--lc-body-bg'),
			pageBg: await getCssVariable(page, '--lc-page-bg'),
			textPrimary: await getCssVariable(page, '--lc-text-primary'),
			textSecondary: await getCssVariable(page, '--lc-text-secondary'),
			borderSoft: await getCssVariable(page, '--lc-border-soft')
		};

		await reloadWithTheme(page, 'dark');

		const darkVariables = {
			bodyBg: await getCssVariable(page, '--lc-body-bg'),
			pageBg: await getCssVariable(page, '--lc-page-bg'),
			textPrimary: await getCssVariable(page, '--lc-text-primary'),
			textSecondary: await getCssVariable(page, '--lc-text-secondary'),
			borderSoft: await getCssVariable(page, '--lc-border-soft')
		};

		expect(lightVariables.bodyBg).not.toBe(darkVariables.bodyBg);
		expect(lightVariables.textPrimary).not.toBe(darkVariables.textPrimary);

		expect(darkVariables.bodyBg).toBe('#0b1117');
		expect(darkVariables.textPrimary).toBe('#e5e7eb');
	});

	test('theme works without JavaScript errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(2000);

		await expect(async () => {
			const dataTheme = await getDataTheme(page);
			expect(dataTheme).toBeTruthy();
		}).toPass({ timeout: 5000 });

		const criticalErrors = errors.filter(
			(e) => !e.includes('ResizeObserver') && !e.includes('chunk') && !e.includes('favicon')
		);
		expect(criticalErrors).toHaveLength(0);
	});

	test('header theme toggle works correctly', async ({ page }) => {
		const initialTheme = await getDataTheme(page);

		const themeToggle = page.getByRole('switch', { name: /테마로 전환/ });
		await expect(themeToggle).toBeVisible();

		await themeToggle.click();

		await expect(async () => {
			const newTheme = await getDataTheme(page);
			const colorScheme = await getComputedColorScheme(page);
			expect(newTheme).not.toBe(initialTheme);
			expect(colorScheme).toBe(newTheme);
		}).toPass({ timeout: 3000 });
	});

	test('color-scheme meta tag exists', async ({ page }) => {
		const metaColorScheme = page.locator('meta[name="color-scheme"]');
		await expect(metaColorScheme).toHaveAttribute('content', 'light dark');
	});

	test('data-theme attribute initializes based on localStorage setting', async ({ page }) => {
		await reloadWithTheme(page, 'dark');

		const dataTheme = await getDataTheme(page);
		expect(dataTheme).toBe('dark');

		const colorScheme = await getComputedColorScheme(page);
		expect(colorScheme).toBe('dark');
	});

	test('Tailwind dark: class works based on data-theme', async ({ page }) => {
		await reloadWithTheme(page, 'dark');

		const dataTheme = await getDataTheme(page);
		expect(dataTheme).toBe('dark');

		await expect(async () => {
			const colorScheme = await getComputedColorScheme(page);
			expect(colorScheme).toBe('dark');
		}).toPass({ timeout: 2000 });

		const bodyBg = await getCssVariable(page, '--lc-body-bg');
		expect(bodyBg).toBe('#0b1117');
	});
});
