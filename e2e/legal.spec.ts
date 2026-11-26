import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectHeadMetadata } from './helpers/head-metadata';

test('the initial legal notice remains stable and unknown versions are rejected', async ({
	request
}) => {
	const response = await request.get('/legal/versions/2026-11-26.1');
	expect(response.status()).toBe(200);
	const html = await response.text();
	expect(html).toContain('최초 법적 고지');
	expect(html).toContain('2026-11-26.1');
	expect(html).toContain('발견하고 이해하도록 돕는 데 목적이 있습니다.');
	expect(html).not.toContain('윤문');
	expect(html).not.toContain('문체 정리');
	for (const version of ['2099-01-01.1']) {
		const missing = await request.get(`/legal/versions/${version}`);
		expect(missing.status()).toBe(404);
		expect(missing.headers()['cache-control']).toContain('no-store');
	}
});

test('history preserves the initial body and navigates back to the reinforced current notice', async ({
	page
}, testInfo) => {
	await page.goto('/legal');
	await expect(page.getByTestId('legal-version')).toContainText('2026-11-26.3');
	await expect(page.getByTestId('legal-body')).toContainText(
		'입법정보의 접근성과 탐색 편의를 높이는 것'
	);
	await page.getByTestId('legal-history-link').click();
	await expect(page).toHaveURL(/#legal-history-title$/);
	const history = page.getByTestId('legal-history');
	await expect(history.getByRole('link')).toHaveCount(3);
	await expect(history).toContainText('최초 법적 고지');
	await expect(history).not.toContainText('윤문');
	await expect(history).not.toContainText('문체 정리');
	await history.screenshot({ path: testInfo.outputPath('legal-history.png') });
	await page.getByTestId('legal-history-2026-11-26.1').click();
	await expect(page).toHaveURL(/\/legal\/versions\/2026-11-26\.1$/);
	await expect(page.getByTestId('legal-archive-banner')).toBeVisible();
	await expect(page.getByTestId('legal-version')).toContainText('2026-11-26.1');
	await expect(page.getByTestId('legal-body')).not.toContainText('AI 학습');
	await expectHeadMetadata(page, { canonical: /\/legal\/versions\/2026-11-26\.1$/ });
	await expect(page.locator('a[role="doc-noteref"]')).toHaveCount(11);
	await page.goBack();
	await expect(page.getByTestId('legal-version')).toContainText('2026-11-26.3');
	await page.getByTestId('legal-permalink').click();
	await expect(page).toHaveURL(/\/legal\/versions\/2026-11-26\.3$/);
});

test('serves the legal notice with sources in server-rendered HTML', async ({ request }) => {
	const response = await request.get('/legal');
	expect(response.status()).toBe(200);
	const html = await response.text();
	expect(html).toContain('법적 고지');
	expect(html).toContain('2021도1533');
	expect(html).toContain('공공데이터법');
	expect(html).not.toContain('09-0381');
	expect(html).toContain('legal-source-1');
	expect(html).not.toContain('기업 고지');
	expect(html).not.toContain('policy.naver.com');
	expect(html).not.toContain('policy.zum.com');
	expect(html).not.toContain('samsungstore.com');
});

test('footer opens legal notice and all footnotes resolve with return links', async ({ page }) => {
	await page.goto('/license');
	await expect(page.locator('footer')).not.toContainText('퍼블릭 도메인');
	await page.getByTestId('footer-legal').click();
	await expect(page).toHaveURL(/\/legal$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('법적 고지');
	await expectHeadMetadata(page, { canonical: /\/legal$/ });
	const citations = page.locator('a[role="doc-noteref"]');
	await expect(citations).toHaveCount(5);
	for (const citation of await citations.all()) {
		const target = await citation.getAttribute('href');
		await expect(page.locator(target!)).toHaveCount(1);
		await expect(page.locator(`${target} a[role="doc-backlink"]`)).toHaveAttribute(
			'href',
			`#${await citation.getAttribute('id')}`
		);
	}
	await citations.first().click();
	await expect(page).toHaveURL(/#legal-source-1$/);
	await page.locator('#legal-source-1 a[role="doc-backlink"]').click();
	await expect(page).toHaveURL(/#legal-ref-1$/);
	await expect(page.getByTestId('legal-contact')).toHaveAttribute(
		'href',
		/^mailto:op@viento\.me\?/
	);
});

test('rights inquiries open an email draft with the displayed subject and body template', async ({
	page
}) => {
	await page.goto('/legal');
	const section = page.locator('section[aria-labelledby="legal-corrections"]');
	await expect(section).not.toContainText('GitHub');
	await expect(section).not.toContainText('이슈는 공개됩니다');
	const link = page.getByTestId('legal-contact');
	await expect(link).toHaveText('op@viento.me');
	const href = new URL((await link.getAttribute('href'))!);
	expect(href.protocol).toBe('mailto:');
	expect(href.pathname).toBe('op@viento.me');
	expect(href.searchParams.get('subject')).toBe('[LawCast] 정정·권리침해·수집 관련 문의');
	const body = await page.getByTestId('legal-email-template').innerText();
	expect(href.searchParams.get('body')).toBe(body);
	for (const label of [
		'문의 유형:',
		'대상 LawCast URL:',
		'원문 URL:',
		'요청 사유 및 권리 관계:',
		'요청하는 조치:'
	]) {
		expect(body).toContain(label);
	}
	await expect(page.getByTestId('legal-history').getByRole('link')).toHaveCount(3);
});

test('legal notice stays readable and accessible across themes and viewports', async ({
	page
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const theme of ['light', 'dark']) {
		await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
		for (const width of [320, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/legal');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expect(page.getByTestId('legal-notice')).toBeVisible();
			await expect(page.getByTestId('footer-social-profiles').getByRole('link')).toHaveCount(3);
			const profile = page.getByTestId('footer-instagram');
			await profile.focus();
			await expect(profile).toBeFocused();
			await expect(profile.locator('linearGradient stop')).toHaveCount(5);
			await profile.hover();
			expect(await profile.locator('svg').evaluate((svg) => getComputedStyle(svg).fill)).toContain(
				'footer-instagram-gradient'
			);
			const results = await new AxeBuilder({ page }).include('main').include('footer').analyze();
			expect(results.violations).toEqual([]);
			await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
			await page.screenshot({ path: testInfo.outputPath(`legal-${theme}-${width}.png`) });
			await page.getByTestId('legal-email-inquiry').screenshot({
				path: testInfo.outputPath(`legal-email-${theme}-${width}.png`)
			});
			await page.locator('html').evaluate((element) => (element.style.fontSize = '200%'));
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
			await page.goto('/notices/2210001');
			const guidance = page.getByTestId('notice-legal-guidance');
			await expect(guidance).toBeVisible();
			await page.getByTestId('notice-rights-inquiry').focus();
			await expect(page.getByTestId('notice-rights-inquiry')).toBeFocused();
			expect(
				(await new AxeBuilder({ page }).include('[data-testid="notice-legal-guidance"]').analyze())
					.violations
			).toEqual([]);
			await guidance.screenshot({
				path: testInfo.outputPath(`notice-legal-${theme}-${width}.png`)
			});
			await page.locator('html').evaluate((element) => (element.style.fontSize = '200%'));
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
		}
	}
});

test('notice details link reuse and rights guidance independently of AI summaries', async ({
	page
}) => {
	await page.goto('/notices/2210001');
	const guidance = page.getByTestId('notice-legal-guidance');
	await expect(guidance).toContainText('법률안은 현행 법령과 다르며');
	await expect(page.getByTestId('notice-reuse-guidance')).toHaveAttribute(
		'href',
		'/legal#legal-rights'
	);
	await page.getByTestId('notice-rights-inquiry').click();
	await expect(page).toHaveURL(/\/legal#legal-corrections$/);
	await expect(page.getByTestId('legal-email-template')).toContainText('회신받을 이메일');
	await expect(page.getByTestId('legal-body')).toContainText('AI 학습');
	await expect(page.getByTestId('legal-body')).toContainText('공식 의견 제출을 대신하지');
});

test('the current body presents verified access grounds without secondary case commentary', async ({
	page
}) => {
	await page.goto('/legal');
	const body = page.getByTestId('legal-body');
	await expect(body).toContainText('접근·이용의 평등');
	await expect(body).toContainText('법정 예외');
	await expect(body).not.toContainText('사람인');
	await expect(body).not.toContainText('엔하위키');
	await expect(page.locator('a[role="doc-noteref"]')).toHaveCount(5);
	await page.goto('/legal/versions/2026-11-26.2');
	await expect(page.getByTestId('legal-version')).toContainText('2026-11-26.2');
	await expect(page.getByTestId('legal-archive-banner')).toBeVisible();
	await expect(page.locator('a[role="doc-noteref"]')).toHaveCount(11);
	await expect(page.getByTestId('legal-body')).toContainText('사람인');
});
