import { test, expect } from '@playwright/test';

const noticeNum = 2210001;
const threadId = noticeNum * 100 + 1;

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
		await expect(navLinks).toHaveCount(6);

		await expect(page.getByTestId('nav-link-home')).toHaveAttribute('href', '/');
		await expect(page.getByTestId('nav-link-notices')).toHaveAttribute('href', '/notices');
		await expect(page.getByTestId('nav-link-notices-changes')).toHaveAttribute(
			'href',
			'/notices/changes'
		);
		await expect(page.getByTestId('nav-link-discussions')).toHaveAttribute('href', '/discussions');
		await expect(page.getByTestId('nav-link-proposals')).toHaveAttribute('href', '/proposals');
		await expect(page.getByTestId('nav-link-webhook')).toHaveAttribute('href', '/webhook');
	});

	test('nav links have correct labels', async ({ page }) => {
		await expect(page.getByTestId('nav-link-home')).toContainText('홈');
		await expect(page.getByTestId('nav-link-notices')).toContainText('입법예고');
		await expect(page.getByTestId('nav-link-notices-changes')).toContainText('변경 내역');
		await expect(page.getByTestId('nav-link-discussions')).toContainText('토론');
		await expect(page.getByTestId('nav-link-proposals')).toContainText('발의 통계');
		await expect(page.getByTestId('nav-link-webhook')).toContainText('알림 설정');
	});

	test('active nav link highlights current page', async ({ page }) => {
		await page.goto('/notices');
		const noticesLink = page.getByTestId('nav-link-notices');
		await expect(noticesLink).toHaveAttribute('aria-current', 'page');
	});

	test('notice discussion detail route highlights discussions nav section', async ({ page }) => {
		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);

		await expect(page.getByTestId('nav-link-discussions')).toHaveAttribute('aria-current', 'page');
		await expect(page.getByTestId('nav-link-notices')).not.toHaveAttribute('aria-current', 'page');
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

	test('footer social links share accessible external link behavior and mobile sizing', async ({
		page
	}) => {
		const footer = page.getByRole('contentinfo');
		const socialProfiles = footer.getByRole('navigation', { name: 'SNS 프로필' });
		const profiles = [
			['LawCast 인스타그램 (새 탭에서 열기)', 'https://www.instagram.com/lawcast.official'],
			['LawCast X (새 탭에서 열기)', 'https://x.com/real_lawcast'],
			['GitHub 저장소 열기', 'https://github.com/vientofactory/lawcast']
		] as const;

		await expect(socialProfiles).toBeVisible();
		await expect(socialProfiles.getByRole('heading')).toHaveCount(0);

		await page.setViewportSize({ width: 390, height: 844 });
		const links = socialProfiles.getByRole('link');
		await expect(links).toHaveCount(profiles.length);
		const firstBox = await links.first().boundingBox();

		for (const [index, [name, href]] of profiles.entries()) {
			const link = links.nth(index);
			await expect(link).toHaveAccessibleName(name);
			await expect(link).toHaveAttribute('href', href);
			await expect(link).toHaveAttribute('target', '_blank');
			await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
			await expect(link.locator('svg')).toBeVisible();
			expect(await link.boundingBox()).toMatchObject({ y: firstBox?.y, width: 44, height: 44 });
		}
	});

	for (const [theme, monochromeColor] of [
		['light', 'rgb(0, 0, 0)'],
		['dark', 'rgb(255, 255, 255)']
	] as const) {
		test(`footer icon links show brand colors on hover and keyboard focus in ${theme} mode`, async ({
			page
		}) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto('/license');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

			const instagram = page.getByTestId('footer-instagram');
			const github = page.getByTestId('footer-github');
			const x = page.getByTestId('footer-x');
			const instagramPath = instagram.locator('path');
			const gradient = /url\(.*#footer-instagram-gradient/;

			for (const link of [instagram, github, x]) {
				await expect(link.locator('svg')).toHaveCSS('height', '24px');
			}

			const restingFill = await instagramPath.evaluate((path) => getComputedStyle(path).fill);
			expect(restingFill).not.toMatch(gradient);
			await instagram.hover();
			await expect(instagramPath).toHaveCSS('fill', gradient);
			await github.hover();
			await expect(github).toHaveCSS('color', monochromeColor);
			await expect(instagramPath).toHaveCSS('fill', restingFill);
			await x.hover();
			await expect(x).toHaveCSS('color', monochromeColor);

			await page.mouse.move(0, 0);
			await x.focus();
			await page.keyboard.press('Shift+Tab');
			await expect(instagram).toBeFocused();
			await expect(instagramPath).toHaveCSS('fill', gradient);
			await page.keyboard.press('Tab');
			await expect(x).toBeFocused();
			await expect(x).toHaveCSS('color', monochromeColor);
			await page.keyboard.press('Tab');
			await expect(github).toBeFocused();
			await expect(github).toHaveCSS('color', monochromeColor);
		});
	}

	test('theme toggle exists', async ({ page }) => {
		const themeSwitch = page.locator('button[role="switch"]');
		await expect(themeSwitch.first()).toBeVisible();
	});

	test('mobile menu opens, navigates and closes itself', async ({ page }) => {
		// The hamburger only shows below the md breakpoint and the desktop nav is hidden.
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/');

		await expect(page.getByTestId('primary-navigation')).toBeHidden();

		const menuButton = page.locator('button[aria-controls="mobile-menu-panel"]');
		await expect(menuButton).toBeVisible();
		await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
		await expect(page.getByTestId('mobile-navigation')).toHaveCount(0);

		await expect(async () => {
			if (await page.getByTestId('mobile-navigation').isVisible()) return;
			await menuButton.click();
			await expect(page.getByTestId('mobile-navigation')).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 20_000 });
		await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

		await page.getByTestId('mobile-nav-link-notices').click();
		await expect(page).toHaveURL(/\/notices$/);
		// Selecting a link closes the dropdown after navigating.
		await expect(page.getByTestId('mobile-navigation')).toHaveCount(0);
	});
});
