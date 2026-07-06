import type { WebhookValidationResult } from '../types/api';

export const KST_TIMEZONE = 'Asia/Seoul';

/**
 * Discord 웹훅 URL 유효성 검증
 */
export function validateDiscordWebhookUrl(url: string): WebhookValidationResult {
	if (!url || !url.trim()) {
		return { isValid: false, message: '웹훅 URL을 입력해주세요.' };
	}

	// URL 길이 검증
	if (url.length > 500) {
		return { isValid: false, message: 'URL이 너무 깁니다. (500자 이내)' };
	}

	// 기본 URL 형식 검증
	try {
		const parsedUrl = new URL(url);

		// HTTPS 프로토콜 강제
		if (parsedUrl.protocol !== 'https:') {
			return { isValid: false, message: 'HTTPS URL만 지원됩니다.' };
		}

		// Discord 도메인 검증
		if (parsedUrl.hostname !== 'discord.com' && parsedUrl.hostname !== 'discordapp.com') {
			return { isValid: false, message: 'Discord 웹훅 URL만 지원됩니다.' };
		}

		// 웹훅 경로 검증
		if (!parsedUrl.pathname.startsWith('/api/webhooks/')) {
			return { isValid: false, message: '올바른 Discord 웹훅 URL 형식이 아닙니다.' };
		}

		// 웹훅 경로 구조 검증
		const pathParts = parsedUrl.pathname.split('/');
		if (pathParts.length < 5 || !pathParts[3] || !pathParts[4]) {
			return { isValid: false, message: '웹훅 URL에 필요한 정보가 누락되었습니다.' };
		}

		const webhookId = pathParts[3];
		const webhookToken = pathParts[4];

		// 웹훅 ID 형식 검증 (Discord Snowflake)
		if (!/^\d{17,20}$/.test(webhookId)) {
			return { isValid: false, message: '올바르지 않은 웹훅 ID 형식입니다.' };
		}

		// 웹훅 토큰 형식 검증
		if (!/^[a-zA-Z0-9_-]{64,68}$/.test(webhookToken)) {
			return { isValid: false, message: '올바르지 않은 웹훅 토큰 형식입니다.' };
		}

		return { isValid: true };
	} catch {
		return { isValid: false, message: '올바르지 않은 URL 형식입니다.' };
	}
}

/**
 * 웹훅 URL 정규화
 */
export function normalizeWebhookUrl(url: string): string {
	try {
		const parsed = new URL(url.trim());
		// 쿼리 파라미터와 해시 제거
		parsed.search = '';
		parsed.hash = '';

		let normalizedPath = parsed.pathname;
		// 끝의 슬래시 제거
		if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
			normalizedPath = normalizedPath.slice(0, -1);
		}

		return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
	} catch {
		return url.trim();
	}
}

/**
 * 날짜 포맷팅
 */
export function formatDate(dateString: string | null): string {
	if (!dateString) return 'N/A';
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return '날짜 오류';
		return date.toLocaleString('ko-KR', { timeZone: KST_TIMEZONE });
	} catch {
		return '날짜 오류';
	}
}

export function formatDateTimeKST(value: string | Date | null | undefined): string {
	if (!value) return 'N/A';

	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) return 'N/A';

	return parsed.toLocaleString('ko-KR', { timeZone: KST_TIMEZONE });
}

export function formatDateOnlyKST(value: string | Date | null | undefined): string {
	if (!value) return 'N/A';

	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) return 'N/A';

	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: KST_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});

	return formatter.format(parsed);
}

/**
 * 외부 링크 열기
 */
export function openExternalLink(url: string): void {
	if (typeof window !== 'undefined') {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
}

/**
 * 파일 다운로드 링크 열기
 */
export function downloadFile(url: string, filename?: string): void {
	if (!url || url.trim() === '' || typeof window === 'undefined') {
		return;
	}

	try {
		// 새 창에서 다운로드 링크 열기
		const link = document.createElement('a');
		link.href = url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';

		if (filename) {
			link.download = filename;
		}

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	} catch (error) {
		console.error('파일 다운로드 실패:', error);
		// 실패 시 새 창에서 URL 열기
		openExternalLink(url);
	}
}

/**
 * 파일 다운로드 가능 여부 확인
 */
export function isDownloadable(url: string): boolean {
	return (
		Boolean(url) && url.trim() !== '' && (url.startsWith('http://') || url.startsWith('https://'))
	);
}
