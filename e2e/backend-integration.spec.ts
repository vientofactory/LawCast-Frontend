import { expect, test, type APIRequestContext } from '@playwright/test';
import type { ApiResponse, ArchiveNoticeListResponse, NoticeDetail } from '../src/lib/types/api.ts';
import { discoverFirstNotice } from './helpers/notice-list.ts';

async function readApi<T>(request: APIRequestContext, path: string): Promise<T> {
	const response = await request.get(`/api${path}`);
	expect(response.status(), path).toBe(200);
	expect(response.headers()['content-type']).toContain('application/json');
	const body = (await response.json()) as ApiResponse<T>;
	expect(body.success, path).toBe(true);
	expect(body.data, path).toBeDefined();
	return body.data!;
}

test('connects the isolated frontend to real backend version and health endpoints', async ({
	request
}) => {
	expect(process.env.DIFFCHAIN_UI_MOCK).toBe('0');
	const version = await readApi<{ version: string }>(request, '/version');
	expect(version.version).toMatch(/^\d+\.\d+\.\d+/);
	const health = await readApi<{ version: string; status: string; dependencies: unknown }>(
		request,
		'/health'
	);
	expect(health.version).toBe(version.version);
	expect(health.status).toBeTruthy();
	expect(health.dependencies).toBeDefined();
});

test('paginates the real archive without relying on fixed fixture identifiers', async ({
	request
}) => {
	const first = await readApi<ArchiveNoticeListResponse>(
		request,
		'/notices/archive?page=1&limit=2&sortOrder=asc'
	);
	const second = await readApi<ArchiveNoticeListResponse>(
		request,
		'/notices/archive?page=2&limit=2&sortOrder=asc'
	);
	expect(first.total).toBeGreaterThan(0);
	expect(first.items.length).toBeGreaterThan(0);
	expect(first.items.length).toBeLessThanOrEqual(2);
	expect(first.page).toBe(1);
	expect(second.page).toBe(2);
	if (second.items.length) expect(second.items[0].num).not.toBe(first.items[0].num);
});

test('opens a discovered real bill and keeps legal guidance after the archive details', async ({
	page
}) => {
	const notice = await discoverFirstNotice(page);
	expect(notice).not.toBeNull();
	const destination = new URL((await notice!.link.getAttribute('href'))!, page.url()).href;
	await notice!.link.click();
	await expect(page).toHaveURL(destination);
	await expect(page.getByTestId('notice-detail-main')).toBeVisible();
	const guidance = page.getByTestId('notice-legal-guidance');
	await expect(guidance).toContainText('법률안은 현행 법령과 다르며');
	await expect(page.locator('main > :last-child')).toHaveAttribute(
		'data-testid',
		'notice-legal-guidance'
	);
	await expect(page.getByTestId('notice-reuse-guidance')).toHaveAttribute(
		'href',
		'/legal#legal-rights'
	);
	await expect(page.getByTestId('notice-rights-inquiry')).toHaveAttribute(
		'href',
		'/legal#legal-corrections'
	);
	await guidance.scrollIntoViewIfNeeded();
	await page.getByTestId('notice-rights-inquiry').focus();
	await expect(page.getByTestId('notice-rights-inquiry')).toBeFocused();
});

test('reads real detail metadata for an identifier returned by the archive API', async ({
	request
}) => {
	const list = await readApi<ArchiveNoticeListResponse>(request, '/notices/archive?page=1&limit=1');
	expect(list.items.length).toBe(1);
	const num = list.items[0].num;
	const detail = await readApi<NoticeDetail>(request, `/notices/${num}/detail`);
	expect(detail.notice.num).toBe(num);
	expect(detail.notice.subject).toBeTruthy();
	expect(detail.notice.link).toMatch(/^https?:\/\//);
	expect(detail.archiveMetadata.archivedAt).toBeTruthy();
});
