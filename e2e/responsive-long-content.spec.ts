import { expect, test, type Locator } from '@playwright/test';
import { viewports } from './helpers/responsive-contracts';
import { expectRouteWithinBounds, prepareResponsivePage } from './helpers/responsive-layout';

const longNotice = {
	num: 2210001,
	title:
		'AI·데이터 산업의 안전한 활용과 개인정보 보호 및 알고리즘 투명성 확보를 위한 인공지능 책임성 강화에 관한 법률 일부개정법률안',
	committee: '과학기술정보방송통신위원회·정무위원회 공동심사 및 인공지능 책임성 특별소위원회',
	proposer: '김가나다 의원 외 123인 및 국가인공지능위원회·개인정보보호위원회 공동발의',
	proposalReason:
		'AI 산업의 건전한 성장과 개인정보 보호를 위한 제도적 기반을 마련하기 위함입니다. 인공지능과 데이터 산업의 발전에 따라 국민의 권익을 보호하고 안전하고 신뢰할 수 있는 활용 기반을 마련하려는 것입니다. 이를 위해 고위험 인공지능 시스템의 투명성과 책임성을 강화하고, 개인정보 보호 및 이용자 권리 보장에 필요한 절차를 규정하며, 관계 기관의 협력 체계를 구축하고자 합니다. 또한 기술 발전과 현장의 다양한 의견을 지속적으로 반영하여 산업의 혁신과 기본권 보호가 조화를 이룰 수 있도록 제도적 기반을 마련하려는 것입니다.'
};

async function expectFullText(locator: Locator, text: string): Promise<void> {
	await expect(locator).toBeVisible();
	await expect(locator).toContainText(text);
	const isTruncated = await locator.evaluate((element) => {
		for (
			let current: Element | null = element;
			current && current.tagName !== 'MAIN';
			current = current.parentElement
		) {
			const style = getComputedStyle(current);
			if (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none') return true;
		}
		return false;
	});
	expect(isTruncated, 'long mock content should not be truncated').toBe(false);
}

const smallViewports = viewports.filter(({ width }) => width <= 768);

for (const viewport of smallViewports) {
	test(`long notice content stays readable at ${viewport.width}px`, async ({ page }) => {
		await prepareResponsivePage(page, viewport);
		const listPath = `/notices?search=${encodeURIComponent('책임성 강화')}&limit=10`;
		await page.goto(listPath);

		const card = page.getByTestId(`notice-card-${longNotice.num}`);
		await expectFullText(card.locator('h3'), longNotice.title);
		await expectFullText(card, longNotice.committee);
		await expectRouteWithinBounds(page, listPath);

		const detailPath = `/notices/${longNotice.num}`;
		await page.goto(detailPath);
		await expectFullText(page.locator('#notice-detail-title'), longNotice.title);
		await expectFullText(page.getByTestId('notice-fact-제안자'), longNotice.proposer);
		await expectFullText(page.getByTestId('notice-fact-소관위원회'), longNotice.committee);
		await expectFullText(
			page.getByTestId('notice-detail-proposal-reason'),
			longNotice.proposalReason
		);
		await expectRouteWithinBounds(page, `${detailPath} (long content)`);
	});
}
