import { expect, test, type Page } from '@playwright/test';

const noticeNum = 2210001;
const threadId = noticeNum * 100 + 1;
const mockEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase()
);

// Envelope shape produced by ApiResponseUtils.success() on the backend.
function buildCreatedThreadResponse(): string {
	const now = new Date().toISOString();
	return JSON.stringify({
		success: true,
		message: '토론 스레드가 성공적으로 개설되었습니다.',
		data: {
			thread: {
				id: threadId,
				noticeNum,
				title: '새 토론 주제',
				status: 'open',
				isLocked: false,
				authorNickname: '익명',
				authorIpMasked: '127.0.***.***',
				commentCount: 1,
				createdAt: now,
				updatedAt: now
			},
			comments: []
		}
	});
}

// Clicking before SvelteKit hydration completes silently does nothing,
// so retry the click until the modal actually opens.
async function openNewThreadModal(page: Page): Promise<void> {
	await expect(async () => {
		await page.getByTestId('discussion-new-thread-button').click({ timeout: 2_000 });
		await expect(page.getByTestId('discussion-new-thread-title')).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 20_000 });
}

test.describe('Discussion UI', () => {
	test.skip(!mockEnabled, 'Discussion UI tests require DIFFCHAIN_UI_MOCK=1.');

	test('shows discussion list and opens a thread from the notice detail page', async ({ page }) => {
		await page.goto(`/notices/${noticeNum}`);

		const discussions = page.getByTestId('notice-discussions');
		await expect(discussions).toBeVisible();
		await expect(page.getByTestId('discussion-thread-list')).toBeVisible();
		await expect(page.getByTestId('discussion-new-thread-button')).toBeVisible();

		const threadLink = page.getByTestId(`discussion-thread-link-${threadId}`);
		await expect(threadLink).toContainText('모의 토론 주제');
		await expect(threadLink).toContainText('54');

		await threadLink.click();
		await expect(page).toHaveURL(new RegExp(`/notices/${noticeNum}/discussions/${threadId}`));
		await expect(page.getByTestId('discussion-thread-detail')).toBeVisible();
		await expect(page.getByTestId('discussion-quote-push-settings')).toBeVisible();
	});

	test('loads more comments while scrolling a mock discussion thread', async ({ page }) => {
		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);

		await expect(page.getByTestId('discussion-comment-1')).toContainText(
			'모의 토론 시작 의견입니다.'
		);
		await expect(page.getByTestId('discussion-comment-20')).toBeVisible();
		await expect(page.getByTestId('discussion-comment-21')).toHaveCount(0);

		await page.getByTestId('discussion-reply-form').scrollIntoViewIfNeeded();

		await expect(page.getByTestId('discussion-comment-21')).toContainText(
			'무한 로딩 검증을 위한 mock 의견 #21'
		);
	});

	test('submits a reply in a discussion thread', async ({ page }) => {
		await page.route(`**/api/discussions/threads/${threadId}/comments`, async (route) => {
			const request = route.request();
			expect(request.method()).toBe('POST');
			expect(request.postDataJSON()).toMatchObject({
				authorNickname: '테스터',
				password: '1234',
				content: '새 테스트 의견입니다.'
			});

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: threadId * 1000 + 55,
					threadId,
					noticeNum,
					sequence: 55,
					authorNickname: '테스터',
					authorIpMasked: '127.0.***.***',
					content: '새 테스트 의견입니다.',
					isDeleted: false,
					isEdited: false,
					editedAt: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				})
			});
		});

		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);

		await expect(page.getByTestId('discussion-thread-summary')).toContainText('모의 토론 주제');
		await expect(page.getByTestId('discussion-comment-1')).toContainText(
			'모의 토론 시작 의견입니다.'
		);
		await expect(page.getByTestId('discussion-reply-form')).toBeVisible();

		await page.getByTestId('discussion-reply-nickname').fill('테스터');
		await page.getByTestId('discussion-reply-password').fill('1234');
		await page.getByTestId('discussion-reply-content').fill('새 테스트 의견입니다.');
		await page.getByTestId('discussion-reply-submit').click();

		await expect(page.getByText('새 의견이 등록되었습니다.')).toBeVisible();
		await expect(page.getByTestId('discussion-comment-55')).toContainText('새 테스트 의견입니다.');
		await expect(page.getByTestId('discussion-reply-content')).toHaveValue('');
	});

	test('new thread modal rejects an empty or whitespace-only title', async ({ page }) => {
		let postCount = 0;
		await page.route(`**/api/notices/${noticeNum}/discussions`, async (route) => {
			if (route.request().method() === 'POST') {
				postCount += 1;
				// Fulfill instead of forwarding so the suite never reaches a real backend.
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: buildCreatedThreadResponse()
				});
				return;
			}
			await route.fallback();
		});

		await page.goto(`/notices/${noticeNum}`);
		await expect(page.getByTestId('discussion-new-thread-button')).toBeVisible();
		await openNewThreadModal(page);

		await page.getByTestId('discussion-new-thread-password').fill('1234');
		await page
			.getByTestId('discussion-new-thread-content')
			.fill('토론을 시작하는 첫 발언 내용입니다.');

		// Empty title must fail client-side validation without any network call.
		await page.getByTestId('discussion-new-thread-submit').click();
		await expect(page.getByTestId('discussion-new-thread-error')).toHaveText(
			'토론 주제를 2자 이상 입력해주세요.'
		);

		// Whitespace-only title must be rejected too (trim happens before the length check).
		await page.getByTestId('discussion-new-thread-title').fill('   ');
		await page.getByTestId('discussion-new-thread-submit').click();
		await expect(page.getByTestId('discussion-new-thread-error')).toHaveText(
			'토론 주제를 2자 이상 입력해주세요.'
		);

		expect(postCount).toBe(0);
	});

	test('creates a new thread with the entered title', async ({ page }) => {
		let createdPayload: Record<string, unknown> | null = null;
		await page.route(`**/api/notices/${noticeNum}/discussions`, async (route) => {
			if (route.request().method() !== 'POST') {
				await route.fallback();
				return;
			}

			createdPayload = route.request().postDataJSON();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: buildCreatedThreadResponse()
			});
		});

		await page.goto(`/notices/${noticeNum}`);
		await expect(page.getByTestId('discussion-new-thread-button')).toBeVisible();
		await openNewThreadModal(page);

		await page.getByTestId('discussion-new-thread-title').fill('  개정안 실효성 검증 토론  ');
		await page.getByTestId('discussion-new-thread-nickname').fill('테스터');
		await page.getByTestId('discussion-new-thread-password').fill('1234');
		await page
			.getByTestId('discussion-new-thread-content')
			.fill('실효성을 검증하기 위한 첫 발언입니다.');
		await page.getByTestId('discussion-new-thread-submit').click();

		// Regression guard for the `{#snippet title()}`/state name collision: the typed
		// title must survive binding and validation instead of failing with an error.
		await expect(page.getByTestId('discussion-new-thread-error')).toHaveCount(0);
		await expect(page).toHaveURL(new RegExp(`/notices/${noticeNum}/discussions/${threadId}`));
		await expect(page.getByTestId('discussion-thread-detail')).toBeVisible();
		await expect(page.getByTestId('discussion-thread-summary')).toContainText('모의 토론 주제');

		expect(createdPayload).toMatchObject({
			title: '개정안 실효성 검증 토론',
			authorNickname: '테스터',
			password: '1234',
			content: '실효성을 검증하기 위한 첫 발언입니다.'
		});
	});
});
