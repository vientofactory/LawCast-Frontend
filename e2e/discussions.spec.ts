import { expect, test } from '@playwright/test';

const noticeNum = 2210001;
const threadId = noticeNum * 100 + 1;
const mockEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase()
);

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
});
