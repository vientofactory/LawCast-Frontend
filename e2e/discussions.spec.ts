import { expect, test, type Page } from '@playwright/test';
import { readModalTransitionSample, startModalTransitionSample } from './helpers/modal-transition';

const noticeNum = 2210001;
const threadId = noticeNum * 100 + 1;

// Comment ids are derived the same way in the server mock (see
// lib/server/diffchain-ui-mock.ts buildMockDiscussionComments).
function mockCommentId(sequence: number): number {
	return threadId * 1000 + sequence;
}

// Clicking before hydration completes silently does nothing, so retry until the
// async-triggered modal is actually on screen.
async function untilVisible(
	page: Page,
	open: () => Promise<void>,
	predicate: () => Promise<void>
): Promise<void> {
	await expect(async () => {
		await open();
		await predicate();
	}).toPass({ timeout: 20_000 });
}
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

	test('quote button inserts a reference into the reply box exactly once', async ({ page }) => {
		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);
		await expect(page.getByTestId('discussion-comment-1')).toBeVisible();

		const reply = page.getByTestId('discussion-reply-content');
		await page.getByTestId('discussion-comment-quote-1').click();

		// ThreadDetailView prepends `>>#<sequence>\n` and focuses the reply textarea.
		await expect(reply).toHaveValue('>>#1\n');
		await expect(page.locator('#reply-content-input')).toBeFocused();

		// Quoting the same comment again must not duplicate the reference.
		await page.getByTestId('discussion-comment-quote-1').click();
		await expect(reply).toHaveValue('>>#1\n');
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

test.describe('Discussion modal behavior', () => {
	test.skip(!mockEnabled, 'Discussion modal tests require DIFFCHAIN_UI_MOCK=1.');

	test('new thread modal exposes ModalShell a11y and closes via Escape, backdrop and close button', async ({
		page
	}) => {
		await page.goto(`/notices/${noticeNum}`);
		await expect(page.getByTestId('discussion-new-thread-button')).toBeVisible();

		await startModalTransitionSample(page);
		await openNewThreadModal(page);

		const dialog = page.getByRole('dialog');
		await expect(dialog).toHaveAttribute('aria-modal', 'true');
		const labelledBy = await dialog.getAttribute('aria-labelledby');
		expect(labelledBy).toBeTruthy();
		await expect(dialog.locator(`#${labelledBy}`)).toHaveText('새 토론 주제 개설');

		// First open goes through the dynamic import: the intro transition must still play.
		await page.waitForTimeout(300);
		const firstOpenSample = await readModalTransitionSample(page);
		expect(firstOpenSample.seen).toBe(true);
		expect(firstOpenSample.minBackdropOpacity).toBeLessThan(0.9);
		expect(firstOpenSample.minDialogScale).toBeLessThan(0.99);

		// Escape → ModalShell.handleKeydown
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);

		// Backdrop click → the transparent inset-0 click catcher
		await openNewThreadModal(page);
		await page.mouse.click(5, 5);
		await expect(dialog).toHaveCount(0);

		// Close (X) button, and the draft state must reset on reopen
		await openNewThreadModal(page);
		await page.getByTestId('discussion-new-thread-title').fill('닫힘 검증용 주제');
		await dialog.getByRole('button', { name: '닫기' }).click();
		await expect(dialog).toHaveCount(0);

		await openNewThreadModal(page);
		await expect(page.getByTestId('discussion-new-thread-title')).toHaveValue('');
	});

	test('comment edit modal validates the password client-side and applies the mocked edit', async ({
		page
	}) => {
		let patchedPayload: Record<string, unknown> | null = null;
		await page.route(`**/api/discussions/comments/*`, async (route) => {
			if (route.request().method() !== 'PATCH') {
				await route.fallback();
				return;
			}

			patchedPayload = route.request().postDataJSON();
			const now = new Date().toISOString();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: mockCommentId(1),
					threadId,
					noticeNum,
					sequence: 1,
					messageType: 'user',
					authorNickname: '익명',
					authorIpMasked: '127.0.0.***',
					content: '수정된 mock 의견입니다.',
					isDeleted: false,
					isEdited: true,
					editedAt: now,
					createdAt: now,
					updatedAt: now
				})
			});
		});

		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);
		await page.getByTestId('discussion-comment-1').getByTitle('의견 수정').click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('의견 수정 (#1)');
		await expect(dialog).toHaveAttribute('aria-modal', 'true');
		// The edit form is pre-filled from the comment it is editing.
		await expect(page.locator('#edit-comment-content')).toHaveValue('모의 토론 시작 의견입니다.');

		// A short password must fail client-side without any network call.
		await page.locator('#action-password-input').fill('123');
		await dialog.getByRole('button', { name: '수정 완료' }).click();
		await expect(dialog).toContainText('비밀번호를 입력해주세요.');
		expect(patchedPayload).toBeNull();

		await page.locator('#action-password-input').fill('1234');
		await page.locator('#edit-comment-content').fill('수정된 mock 의견입니다.');
		await dialog.getByRole('button', { name: '수정 완료' }).click();

		await expect(dialog).toHaveCount(0);
		await expect(page.getByText('의견이 성공적으로 수정되었습니다.')).toBeVisible();
		await expect(page.getByTestId('discussion-comment-1')).toContainText('수정된 mock 의견입니다.');
		expect(patchedPayload).toMatchObject({
			password: '1234',
			content: '수정된 mock 의견입니다.'
		});
	});

	test('comment delete modal cancels without a request and soft-deletes on confirm', async ({
		page
	}) => {
		let deleteCalls = 0;
		await page.route(`**/api/discussions/comments/*`, async (route) => {
			if (route.request().method() !== 'DELETE') {
				await route.fallback();
				return;
			}

			deleteCalls += 1;
			const now = new Date().toISOString();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: mockCommentId(2),
					threadId,
					noticeNum,
					sequence: 2,
					messageType: 'user',
					authorNickname: '익명',
					authorIpMasked: '127.0.1.***',
					content: '삭제된 mock 의견입니다.',
					isDeleted: true,
					isEdited: false,
					editedAt: null,
					createdAt: now,
					updatedAt: now
				})
			});
		});

		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);
		await page.getByTestId('discussion-comment-2').getByTitle('의견 삭제').click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('의견 삭제 (#2)');
		await expect(dialog).toContainText('본문이 삭제된 상태로 보존');

		// Cancelling must not send a delete request.
		await dialog.getByRole('button', { name: '취소' }).click();
		await expect(dialog).toHaveCount(0);
		expect(deleteCalls).toBe(0);

		await page.getByTestId('discussion-comment-2').getByTitle('의견 삭제').click();
		await page.locator('#action-password-input').fill('1234');
		await dialog.getByRole('button', { name: '삭제 확인' }).click();

		await expect(dialog).toHaveCount(0);
		await expect(page.getByText('의견이 삭제되었습니다.')).toBeVisible();
		await expect(page.getByTestId('discussion-comment-2')).toContainText('삭제된 mock 의견입니다.');
		expect(deleteCalls).toBe(1);
	});

	test('thread status modal closes the thread through the mocked status change', async ({
		page
	}) => {
		let statusPayload: Record<string, unknown> | null = null;
		await page.route(`**/api/discussions/threads/${threadId}/status`, async (route) => {
			statusPayload = route.request().postDataJSON();
			const now = new Date().toISOString();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: threadId,
					noticeNum,
					title: '모의 토론 주제',
					status: 'closed',
					isLocked: false,
					authorNickname: '익명',
					authorIpMasked: '127.0.***.***',
					commentCount: 54,
					createdAt: now,
					updatedAt: now
				})
			});
		});

		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);
		await page.getByRole('button', { name: '토론 닫기' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('토론 상태 변경 (토론 닫기)');
		await expect(dialog).toContainText('토론을 닫으면 추가 의견 작성이 제한됩니다.');

		await page.locator('#action-password-input').fill('1234');
		await dialog.getByRole('button', { name: '확인' }).click();

		await expect(dialog).toHaveCount(0);
		await expect(page.getByText('토론이 성공적으로 닫혔습니다.')).toBeVisible();
		expect(statusPayload).toMatchObject({ password: '1234', status: 'closed' });

		// Closing the thread must flip the status control and hide comment actions.
		await expect(page.getByRole('button', { name: '토론 다시 열기' })).toBeVisible();
		await expect(page.getByRole('button', { name: '토론 닫기' })).toHaveCount(0);
		await expect(page.getByTestId('discussion-comment-1').getByTitle('의견 수정')).toHaveCount(0);
		await expect(page.getByTestId('discussion-comment-1').getByTitle('의견 삭제')).toHaveCount(0);
		// The reply box is removed entirely while the thread is closed.
		await expect(page.getByTestId('discussion-reply-form')).toHaveCount(0);
		await expect(page.getByTestId('discussion-comment-list')).toBeVisible();
	});

	test('quote push consent modal opens with the mocked push config and records the dismissal', async ({
		page
	}) => {
		await page.route('**/api/push/public-key', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					data: { enabled: true, publicKey: 'BFakeE2EVapidPublicKey' }
				})
			})
		);

		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);

		// The settings button only renders after the async push config fetch resolves,
		// and clicking before hydration does nothing — retry both.
		await untilVisible(
			page,
			async () => {
				await page.getByTestId('discussion-quote-push-settings').click({ timeout: 2_000 });
			},
			async () => {
				await expect(page.getByTestId('discussion-push-consent-modal')).toBeVisible({
					timeout: 1_000
				});
			}
		);

		const modal = page.getByTestId('discussion-push-consent-modal');
		await expect(modal).toContainText('인용 알림을 받아보시겠어요?');
		await expect(modal).toHaveAttribute('aria-modal', 'true');
		// WebPushConsentForm renders inside the modal in thread (compact) mode.
		await expect(modal).toContainText('이 스레드의 인용 알림');

		await modal.getByRole('button', { name: '나중에' }).click();
		await expect(modal).toHaveCount(0);

		const dismissed = await page.evaluate(
			(key) => localStorage.getItem(key),
			`lawcast-quote-push-dismissed:${threadId}`
		);
		expect(dismissed).toBe('1');
	});
});

test.describe('Global discussions list page', () => {
	test.skip(!mockEnabled, 'Discussions list tests require DIFFCHAIN_UI_MOCK=1.');

	test('lists mock threads and opens the thread detail page', async ({ page }) => {
		await page.goto('/discussions');

		await expect(page.getByTestId('discussions-list')).toBeVisible();
		const threadLink = page.getByTestId(`discussions-list-link-${threadId}`);
		await expect(threadLink).toContainText('모의 토론 주제');
		await expect(threadLink).toContainText('진행 중');

		await threadLink.click();
		await expect(page).toHaveURL(new RegExp(`/notices/${noticeNum}/discussions/${threadId}`));
		await expect(page.getByTestId('discussion-thread-detail')).toBeVisible();
	});

	test('status filter tabs update the query param and the selected tab', async ({ page }) => {
		await page.goto('/discussions');

		// No status param → the server loader defaults to open threads.
		await expect(page.getByTestId('discussions-filter-open')).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByTestId('discussions-filter-all')).toHaveAttribute(
			'aria-selected',
			'false'
		);

		await page.getByTestId('discussions-filter-closed').click();
		await expect(page).toHaveURL(/status=closed/);
		await expect(page.getByTestId('discussions-filter-closed')).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByTestId('discussions-filter-open')).toHaveAttribute(
			'aria-selected',
			'false'
		);
		await expect(page.getByTestId('discussions-list')).toBeVisible();

		await page.getByTestId('discussions-filter-all').click();
		await expect(page).toHaveURL(/status=all/);
		await expect(page.getByTestId('discussions-filter-all')).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});
});
