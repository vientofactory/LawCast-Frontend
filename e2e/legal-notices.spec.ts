import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { LegalNotice } from '../src/lib/types/legal-notice';

const directory = new URL('../src/lib/server/legal-notices/', import.meta.url);
const notices: LegalNotice[] = readdirSync(directory)
	.filter((file) => file.endsWith('.json'))
	.map((file) => JSON.parse(readFileSync(new URL(file, directory), 'utf8')) as LegalNotice);

test('preserves recorded legal notices independently of presentation changes', () => {
	const hashes: Record<string, string> = {
		'2026-11-26.1': '41ad1df21c23a5ac96530d06a3af4c95507e645f4dc86b0ff15f15ef02bbdd1b',
		'2026-11-26.2': 'b3cb7cd4d4f5e3f5ab56393342cb4720a13c5967794d4e2b52a64221203f8729',
		'2026-11-26.3': '46804bf53d1513eb4f655f48616fcb1a09f5a6af1b1626b06a3dd184ad0e4a3e',
		'2026-11-27.1': '7eaadefffe49fd83db55f0cd3d7f9c9395abaa0e006111ed0bde752539466877'
	};
	expect(notices.map(({ id }) => id).sort()).toEqual(Object.keys(hashes).sort());
	for (const { id, title, intro, sections, sources } of notices) {
		expect(
			createHash('sha256').update(JSON.stringify({ title, intro, sections, sources })).digest('hex')
		).toBe(hashes[id]);
	}
});

test('each snapshot owns its complete body, metadata and bidirectional citation targets', () => {
	expect(new Set(notices.map((notice) => notice.id)).size).toBe(notices.length);
	for (const notice of notices) {
		expect(notice.id).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
		expect(notice.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(notice.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(notice.changeSummary).toBeTruthy();
		expect(notice.sections).toHaveLength(7);
		expect(new Set(notice.sections.map((section) => section.id)).size).toBe(7);
		expect(notice.sources).toHaveLength(notice.id >= '2026-11-26.3' ? 5 : 11);
		const citations: number[] = [];
		for (const section of notice.sections) {
			expect(section.paragraphs.length).toBeGreaterThan(0);
			if (section.emailTemplate) {
				expect(section.emailTemplate.to).toMatch(/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/);
				expect(section.emailTemplate.subject).toBeTruthy();
				expect(section.emailTemplate.body).toBeTruthy();
				expect(section.emailTemplate.subject).not.toMatch(/[\r\n]/);
			}
			for (const paragraph of section.paragraphs) {
				expect(paragraph.length).toBeGreaterThan(0);
				for (const part of paragraph) {
					if (part.source !== undefined) citations.push(part.source);
					else expect(typeof part.text).toBe('string');
					if (part.href) expect(part.href).toMatch(/^(https:\/\/|\/(?!\/))/);
				}
			}
		}
		expect(citations.sort((a, b) => a - b)).toEqual(notice.sources.map((_, index) => index + 1));
		for (const source of notice.sources) {
			expect(source.href).toMatch(/^https:\/\//);
			expect(source.title).toBeTruthy();
			expect(source.note).toBeTruthy();
		}
	}
});

test('rights inquiries store the email recipient and reusable body with the initial notice', () => {
	const section = notices[0].sections.find((entry) => entry.id === 'legal-corrections');
	const template = section?.emailTemplate;
	if (!template) throw new Error('Missing rights inquiry email template');
	expect(template.to).toBe('op@viento.me');
	expect(template.body).toContain('대상 LawCast URL:');
	expect(template.body).toContain('요청 사유 및 권리 관계:');
	expect(template.body).toContain('요청하는 조치:');
	expect(JSON.stringify(section)).not.toMatch(/github\.com|GitHub|이슈는 공개됩니다/);
});

test('the initial notice keeps the final copy without unpublished editorial history', () => {
	expect(notices).toHaveLength(4);
	const [initial] = notices;
	expect(initial.id).toBe('2026-11-26.1');
	expect(initial.changeSummary).toBe('최초 법적 고지');
	expect(initial.intro).toContain('공공 입법정보를 탐색하고 이해하도록 돕는');
	expect(JSON.stringify(initial)).not.toContain('윤문');
});

test('the reinforced notice covers reuse, stale archives and minimal rights requests', () => {
	const current = notices.find((notice) => notice.id === '2026-11-26.2')!;
	const body = JSON.stringify(current.sections);
	for (const text of [
		'AI 학습',
		'수집 당시의 기록',
		'공식 의견 제출을 대신하지',
		'신분증 사본',
		'이미 발송된 알림',
		'접수가 완료되지는'
	]) {
		expect(body).toContain(text);
	}
	const template = current.sections.find(
		(section) => section.id === 'legal-corrections'
	)!.emailTemplate!;
	expect(template.body).toContain('문제가 되는 위치');
	expect(template.body).toContain('회신받을 이메일');
	expect(template.to).toBe('op@viento.me');
});

test('the grounded notice emphasizes verified grounds without claiming blanket permission', () => {
	const current = notices.find((notice) => notice.id === '2026-11-26.3')!;
	const body = JSON.stringify(current.sections);
	for (const text of [
		'접근·이용의 평등',
		'법정 예외',
		'객관적 사정',
		'법률상 허용 여부가 확정되는 것은 아닙니다',
		'배제할 수 없는 책임'
	])
		expect(body).toContain(text);
	for (const text of [
		'사람인',
		'엔하위키',
		'09-0381',
		'robots.txt 준수 완료',
		'국회의 허락을 받음'
	])
		expect(JSON.stringify(current)).not.toContain(text);
	expect(current.sources.every((source) => source.href.startsWith('https://www.law.go.kr/'))).toBe(
		true
	);
	const previous = notices.find((notice) => notice.id === '2026-11-26.2')!;
	expect(current.sections.find((section) => section.id === 'legal-corrections')).toEqual(
		previous.sections.find((section) => section.id === 'legal-corrections')
	);
});

test('the open-source notice separates third-party operation from non-excludable liability', () => {
	const current = notices.find((notice) => notice.id === '2026-11-27.1')!;
	const previous = notices.find((notice) => notice.id === '2026-11-26.3')!;
	const body = JSON.stringify(current.sections);
	for (const text of [
		'MIT 라이선스 하에 배포되는 오픈소스',
		'저작권 고지와 라이선스 고지를 유지',
		'공식 사이트와 운영상 관련이 없으며',
		'해당 운영자의 행위와 관련 법령',
		'소프트웨어를 있는 그대로 제공',
		'책임이 LawCast 공식 사이트 운영자나 소프트웨어 저작자·저작권자에게 귀속되는 것은 아닙니다',
		'법령상 배제할 수 없는 책임',
		'소프트웨어 라이선스는 수집 자료의 이용허락을 대신하지 않습니다'
	])
		expect(body).toContain(text);
	expect(current.sections[0].paragraphs.flat()).toContainEqual({
		text: '라이선스 안내',
		href: '/license'
	});
	expect(current.sections.slice(1)).toEqual(previous.sections.slice(1));
	expect(current.sources).toEqual(previous.sources);
	expect(current.reviewedOn).toBe(previous.reviewedOn);
});
