import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('renders the main content area', async ({ page }) => {
		const main = page.getByTestId('home-main');
		await expect(main).toBeVisible();
	});

	test('displays the hero section with title', async ({ page }) => {
		const hero = page.getByTestId('home-hero');
		await expect(hero).toBeVisible();

		const heading = page.locator('#home-page-title');
		await expect(heading).toBeVisible();
		await expect(heading).toContainText('국회 입법예고');
	});

	test('displays the subtitle description', async ({ page }) => {
		const hero = page.getByTestId('home-hero');
		await expect(hero).toContainText('LawCast는');
	});

	test('shows the status region with signal cards', async ({ page }) => {
		const statusRegion = page.getByTestId('home-status-region');
		await expect(statusRegion).toBeVisible();

		await expect(page.getByTestId('home-status-card-archive')).toBeVisible();
		await expect(page.getByTestId('home-status-card-changes')).toBeVisible();
		await expect(page.getByTestId('home-status-card-sync')).toBeVisible();
		await expect(page.getByTestId('home-status-card-review')).toBeVisible();
	});

	test('archive status card links to notices', async ({ page }) => {
		const archiveLink = page.getByTestId('home-status-link-archive');
		await expect(archiveLink).toBeVisible();
		await expect(archiveLink).toHaveAttribute('href', '/notices');
	});

	test('changes status card links to changes', async ({ page }) => {
		const changesLink = page.getByTestId('home-status-link-changes');
		await expect(changesLink).toBeVisible();
		await expect(changesLink).toHaveAttribute('href', '/notices/changes');
	});

	test('search region is visible with form', async ({ page }) => {
		const searchRegion = page.getByTestId('home-search-region');
		await expect(searchRegion).toBeVisible();

		const searchForm = page.getByTestId('home-search-form');
		await expect(searchForm).toBeVisible();
	});

	test('search input has correct placeholder', async ({ page }) => {
		const searchInput = page.getByTestId('home-search-input');
		await expect(searchInput).toBeVisible();
		await expect(searchInput).toHaveAttribute('placeholder');
	});

	test('search input is required', async ({ page }) => {
		const searchInput = page.getByTestId('home-search-input');
		await expect(searchInput).toHaveAttribute('required');
	});

	test('search submit button is visible', async ({ page }) => {
		const submitBtn = page.getByTestId('home-search-submit');
		await expect(submitBtn).toBeVisible();
		await expect(submitBtn).toHaveAttribute('type', 'submit');
	});

	test('search form submits to /notices with search param', async ({ page }) => {
		const searchForm = page.getByTestId('home-search-form');
		await expect(searchForm).toHaveAttribute('action', '/notices');
		await expect(searchForm).toHaveAttribute('method', 'GET');
	});

	test('quick keywords section is visible', async ({ page }) => {
		const keywords = page.getByTestId('home-quick-keywords');
		await expect(keywords).toBeVisible();
	});

	test('quick keyword links navigate to notices with search param', async ({ page }) => {
		const firstKeyword = page.getByTestId('home-quick-keywords').locator('a').first();
		const href = await firstKeyword.getAttribute('href');
		expect(href).toMatch(/^\/notices\?/);
		expect(href).toContain('search=');
		expect(href).toContain('fullText=true');
	});

	test('recent notices region is present', async ({ page }) => {
		const recentNotices = page.getByTestId('recent-notices-region');
		await expect(recentNotices).toBeVisible();
	});

	test('section navigation (sr-only) is present', async ({ page }) => {
		const sectionNav = page.getByTestId('home-section-navigation');
		await expect(sectionNav).toBeAttached();
	});

	test('scroll cue is present in the DOM', async ({ page }) => {
		const scrollCue = page.getByRole('link', { name: '최근 입법예고 섹션으로 이동' });
		await expect(scrollCue).toBeAttached();
	});

	test('page title includes LawCast branding', async ({ page }) => {
		await expect(page).toHaveTitle(/LawCast/);
	});

	test('meta description is set', async ({ page }) => {
		const meta = page.locator('meta[name="description"]');
		await expect(meta).toHaveAttribute('content', /./);
	});

	test('structured data (JSON-LD) is present', async ({ page }) => {
		const jsonLd = page.locator('script[type="application/ld+json"]');
		await expect(jsonLd).toBeAttached();
		const content = await jsonLd.textContent();
		expect(content).toContain('WebSite');
		expect(content).toContain('LawCast');
	});

	test('canonical link is set', async ({ page }) => {
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toBeAttached();
	});

	test('hero search input allows typing', async ({ page }) => {
		const searchInput = page.getByTestId('home-search-input');
		await searchInput.fill('테스트 검색어');
		await expect(searchInput).toHaveValue('테스트 검색어');
	});
});
