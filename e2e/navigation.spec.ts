import { test, expect } from '@playwright/test';

test.describe('Global Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('site header is visible', async ({ page }) => {
		const header = page.getByTestId('site-header');
		await expect(header).toBeVisible();
	});

	test('brand links to home', async ({ page }) => {
		const brand = page.getByTestId('site-brand');
		await expect(brand).toBeVisible();
		await expect(brand).toHaveAttribute('href', '/');
	});

	test('primary navigation contains all menu items', async ({ page }) => {
		const nav = page.getByTestId('primary-navigation');
		await expect(nav).toBeVisible();

		const navLinks = nav.locator('a');
		await expect(navLinks).toHaveCount(5);

		await expect(page.getByTestId('nav-link-home')).toHaveAttribute('href', '/');
		await expect(page.getByTestId('nav-link-notices')).toHaveAttribute('href', '/notices');
		await expect(page.getByTestId('nav-link-notices-changes')).toHaveAttribute(
			'href',
			'/notices/changes'
		);
		await expect(page.getByTestId('nav-link-proposals')).toHaveAttribute('href', '/proposals');
		await expect(page.getByTestId('nav-link-webhook')).toHaveAttribute('href', '/webhook');
	});

	test('nav links have correct labels', async ({ page }) => {
		await expect(page.getByTestId('nav-link-home')).toContainText('홈');
		await expect(page.getByTestId('nav-link-notices')).toContainText('입법예고');
		await expect(page.getByTestId('nav-link-notices-changes')).toContainText('변경 내역');
		await expect(page.getByTestId('nav-link-proposals')).toContainText('발의 통계');
		await expect(page.getByTestId('nav-link-webhook')).toContainText('알림 설정');
	});

	test('active nav link highlights current page', async ({ page }) => {
		await page.goto('/notices');
		const noticesLink = page.getByTestId('nav-link-notices');
		await expect(noticesLink).toHaveAttribute('aria-current', 'page');
	});

	test('navigating between pages updates active state', async ({ page }) => {
		// Home page
		await page.goto('/');
		await expect(page.getByTestId('nav-link-home')).toHaveAttribute('aria-current', 'page');

		// Navigate to notices
		await page.getByTestId('nav-link-notices').click();
		await expect(page).toHaveURL('/notices');
		await expect(page.getByTestId('nav-link-notices')).toHaveAttribute('aria-current', 'page');

		// Navigate to changes
		await page.getByTestId('nav-link-notices-changes').click();
		await expect(page).toHaveURL('/notices/changes');
		await expect(page.getByTestId('nav-link-notices-changes')).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	test('skip-to-content link is present and functional', async ({ page }) => {
		const skipLink = page.locator('a[href="#main-content"]');
		await expect(skipLink).toBeAttached();
	});

	test('footer is present', async ({ page }) => {
		const footer = page.locator('footer');
		await expect(footer).toBeVisible();
	});

	test('theme toggle exists', async ({ page }) => {
		const themeSwitch = page.locator('button[role="switch"]');
		await expect(themeSwitch.first()).toBeVisible();
	});
});
