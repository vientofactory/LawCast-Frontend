<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, Bell, Plus, ExternalLink, Loader2 } from 'lucide-svelte';
	import axios from 'axios';
	import Header from '$lib/components/Header.svelte';
	import { env } from '$env/dynamic/public';
	import {
		PUBLIC_API_BASE_URL as STATIC_API_URL,
		PUBLIC_RECAPTCHA_SITE_KEY as STATIC_RECAPTCHA_KEY
	} from '$env/static/public';

	// Try dynamic env first, fallback to static, then to defaults
	const API_BASE = env.PUBLIC_API_BASE_URL || STATIC_API_URL || 'http://localhost:3001/api';
	const RECAPTCHA_SITE_KEY_VAL = env.PUBLIC_RECAPTCHA_SITE_KEY || STATIC_RECAPTCHA_KEY || '';

	let recaptchaLoaded = false;
	let recaptchaWidgetId: number | null = null;

	interface Notice {
		num: number;
		subject: string;
		proposerCategory: string;
		committee: string;
		numComments: number;
		link: string;
	}

	let recentNotices: Notice[] = [];
	let stats = {
		webhooks: { total: 0, active: 0, inactive: 0 },
		cache: { size: 0, lastUpdated: null, maxSize: 50 }
	};
	let newWebhookUrl = '';
	let recaptchaToken = '';

	let isInitialLoading = true;
	let isSubmitting = false;
	let error = '';
	let success = '';

	onMount(async () => {
		try {
			await Promise.all([loadRecentNotices(), loadStats()]);
			loadRecaptcha();
		} catch (err) {
			console.error('Failed to load initial data:', err);
			error = '초기 데이터 로딩에 실패했습니다. 페이지를 새로고침해주세요.';
		} finally {
			isInitialLoading = false;
			// reCAPTCHA 로드가 낦을 경우를 대비해 지연 렌더링 시도
			setTimeout(() => {
				if (recaptchaLoaded && recaptchaWidgetId === null) {
					renderRecaptcha();
				}
			}, 1000);
		}
	});

	async function loadRecentNotices() {
		try {
			const response = await axios.get(`${API_BASE}/notices/recent`);
			recentNotices = response.data.data;
		} catch (err) {
			console.error('Failed to load recent notices:', err);
		}
	}

	async function loadStats() {
		try {
			const response = await axios.get(`${API_BASE}/stats`);
			stats = response.data.data;
		} catch (err) {
			console.error('Failed to load stats:', err);
		}
	}

	function loadRecaptcha() {
		if (typeof window !== 'undefined' && !recaptchaLoaded) {
			const script = document.createElement('script');
			script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
			script.async = true;
			script.defer = true;
			document.head.appendChild(script);

			// 전역 콜백 설정
			(window as unknown as Window & { onRecaptchaLoad: () => void }).onRecaptchaLoad = () => {
				recaptchaLoaded = true;
				renderRecaptcha();
			};
		}
	}

	function renderRecaptcha() {
		if (
			typeof window !== 'undefined' &&
			(
				window as unknown as {
					grecaptcha: { render: (container: string, options: Record<string, unknown>) => number };
				}
			).grecaptcha &&
			recaptchaLoaded
		) {
			const container = document.getElementById('recaptcha-container');
			if (container && recaptchaWidgetId === null) {
				recaptchaWidgetId = (
					window as unknown as {
						grecaptcha: { render: (container: string, options: Record<string, unknown>) => number };
					}
				).grecaptcha.render('recaptcha-container', {
					sitekey: RECAPTCHA_SITE_KEY_VAL,
					callback: (token: string) => {
						recaptchaToken = token;
					},
					'expired-callback': () => {
						recaptchaToken = '';
					},
					'error-callback': () => {
						error = 'reCAPTCHA 인증에 실패했습니다. 다시 시도해주세요.';
						recaptchaToken = '';
					}
				});
			}
		}
	}

	function resetRecaptcha() {
		if (
			typeof window !== 'undefined' &&
			(window as unknown as { grecaptcha: { reset: (id: number) => void } }).grecaptcha &&
			recaptchaWidgetId !== null
		) {
			(window as unknown as { grecaptcha: { reset: (id: number) => void } }).grecaptcha.reset(
				recaptchaWidgetId
			);
			recaptchaToken = '';
		}
	}

	async function addWebhook() {
		// 초기 에러 초기화
		error = '';
		success = '';

		// 웹훅 URL 유효성 검증
		const validation = validateDiscordWebhookUrl(newWebhookUrl);
		if (!validation.isValid) {
			error = validation.message || '올바르지 않은 웹훅 URL입니다.';
			return;
		}

		// reCAPTCHA 검증
		if (!recaptchaToken || recaptchaToken.trim().length === 0) {
			error = 'reCAPTCHA 인증을 완료해주세요.';
			return;
		}

		// 중복 제출 방지
		if (isSubmitting) {
			return;
		}

		isSubmitting = true;

		try {
			// URL 정규화
			const normalizedUrl = normalizeWebhookUrl(newWebhookUrl);

			const response = await axios.post(
				`${API_BASE}/webhooks`,
				{
					url: normalizedUrl,
					recaptchaToken: recaptchaToken.trim()
				},
				{
					timeout: 10000, // 10초 타임아웃
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);

			if (response.data.success) {
				success = response.data.message || '웹훅이 성공적으로 등록되었습니다.';
				newWebhookUrl = '';
				resetRecaptcha();
				await loadStats(); // 통계 업데이트
			} else {
				error = response.data.message || '웹훅 등록에 실패했습니다.';
				resetRecaptcha();
			}
		} catch (err: unknown) {
			resetRecaptcha();

			if (axios.isAxiosError(err)) {
				const response = err.response;

				if (response?.status === 400) {
					// 유효성 검증 오류
					if (response.data?.errors && Array.isArray(response.data.errors)) {
						error = response.data.errors.join(' ');
					} else {
						error = response.data?.message || '입력 데이터가 올바르지 않습니다.';
					}
				} else if (response?.status === 409) {
					// 중복 URL
					error = '이미 등록된 웹훅 URL입니다.';
				} else if (response?.status === 429) {
					// 너무 많은 요청
					error = '너무 많은 웹훅이 등록되어 있습니다.';
				} else if (response && response.status >= 500) {
					// 서버 오류
					error = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
				} else {
					error = response?.data?.message || '웹훅 등록에 실패했습니다.';
				}
			} else if (err instanceof Error) {
				if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
					error = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
				} else if (err.message.includes('Network Error')) {
					error = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
				} else {
					error = '웹훅 등록 중 오류가 발생했습니다.';
				}
			} else {
				error = '예상치 못한 오류가 발생했습니다.';
			}
		} finally {
			isSubmitting = false;
		}
	}

	function clearMessage() {
		error = '';
		success = '';
	}

	function formatDate(dateString: string | null) {
		if (!dateString) return '없음';
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return '날짜 오류';
			return date.toLocaleString('ko-KR');
		} catch {
			return '날짜 오류';
		}
	}

	function openNoticeLink(link: string) {
		window.open(link, '_blank', 'noopener,noreferrer');
	}

	function validateDiscordWebhookUrl(url: string): { isValid: boolean; message?: string } {
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

	function normalizeWebhookUrl(url: string): string {
		try {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
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
</script>

<svelte:head>
	<title>LawCast - 국회 입법예고 알리미</title>
	<meta name="description" content="국회 입법예고 변동사항을 디스코드로 알려드립니다." />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Initial Loading State -->
		{#if isInitialLoading}
			<div class="flex items-center justify-center py-16">
				<div class="text-center">
					<Loader2 class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
					<p class="text-gray-600">데이터를 불러오는 중...</p>
				</div>
			</div>
		{:else}
			<!-- Messages -->
			{#if error}
				<div class="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center">
							<AlertTriangle class="mr-2 h-5 w-5 text-red-600" />
							<span class="text-red-800">{error}</span>
						</div>
						<div class="flex space-x-2">
							{#if error.includes('초기 데이터')}
								<button
									on:click={() => location.reload()}
									class="text-sm text-red-600 underline hover:text-red-800"
								>
									새로고침
								</button>
							{/if}
							<button on:click={clearMessage} class="text-lg text-red-600 hover:text-red-800"
								>×</button
							>
						</div>
					</div>
				</div>
			{/if}

			{#if success}
				<div class="mb-6 rounded-md border border-green-200 bg-green-50 p-4">
					<div class="flex items-center">
						<div class="mr-2 h-5 w-5 text-green-600">✓</div>
						<span class="text-green-800">{success}</span>
						<button on:click={clearMessage} class="ml-auto text-green-600 hover:text-green-800"
							>×</button
						>
					</div>
				</div>
			{/if}

			<i class="text-gray-500">
				게임에 잠수함 패치는 있을 수 있지만, 법안에 잠수함 패치는 있을 수 없습니다.<br />
				모든 사람들이 입법예고의 투명한 감시 권리를 가질 수 있는 그 날까지 LawCast는 함께합니다.
			</i>

			<div class="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
				<!-- Webhook Registration -->
				<div class="rounded-lg bg-white p-6 shadow">
					<h2 class="mb-4 flex items-center text-lg font-semibold text-gray-900">
						<Plus class="mr-2 h-5 w-5" />
						웹훅 등록
					</h2>

					<form on:submit|preventDefault={addWebhook} class="space-y-4">
						<div>
							<label for="webhook-url" class="mb-2 block text-sm font-medium text-gray-700">
								Discord 웹훅 URL *
							</label>
							<input
								id="webhook-url"
								type="url"
								bind:value={newWebhookUrl}
								placeholder="https://discord.com/api/webhooks/..."
								class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
								maxlength="500"
								autocomplete="off"
								spellcheck="false"
								required
							/>
							{#if newWebhookUrl && !validateDiscordWebhookUrl(newWebhookUrl).isValid}
								<p class="mt-1 text-sm text-red-600">
									{validateDiscordWebhookUrl(newWebhookUrl).message}
								</p>
							{/if}
						</div>

						<!-- reCAPTCHA -->
						<div>
							<div id="recaptcha-container" class="mb-4"></div>
							{#if !recaptchaLoaded}
								<div class="mb-2 text-sm text-gray-500">
									<Loader2 class="mr-1 inline h-4 w-4 animate-spin" />
									reCAPTCHA 로딩 중...
								</div>
							{/if}
						</div>

						<button
							type="submit"
							disabled={isSubmitting || isInitialLoading}
							class="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isSubmitting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								등록 중...
							{:else}
								<Plus class="mr-2 h-4 w-4" />
								웹훅 등록
							{/if}
						</button>
					</form>
				</div>

				<!-- Recent Notices -->
				<div class="rounded-lg bg-white p-6 shadow">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="text-lg font-semibold text-gray-900">
							최근 입법예고 ({recentNotices.length})
						</h2>
						{#if recentNotices.length > 0}
							<a
								href="./notices"
								class="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
							>
								전체 보기
								<ExternalLink class="ml-1 h-4 w-4" />
							</a>
						{/if}
					</div>

					{#if recentNotices.length === 0}
						<div class="py-8 text-center">
							<div class="mb-2 text-gray-400">
								<Bell class="mx-auto h-8 w-8" />
							</div>
							<p class="text-gray-500">아직 수집된 입법예고가 없습니다.</p>
							<p class="mt-1 text-sm text-gray-400">
								서버가 시작되면 자동으로 데이터를 수집합니다.
							</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each recentNotices.slice(0, 5) as notice (notice.num)}
								<div class="rounded-md border border-gray-200 p-3">
									<div class="mb-2 flex items-start justify-between">
										<h3 class="line-clamp-2 text-sm font-medium text-gray-900">
											{notice.subject}
										</h3>
										<button
											on:click={() => openNoticeLink(notice.link)}
											class="ml-2 shrink-0 border-none bg-transparent p-1 text-blue-600 hover:text-blue-800"
											title="자세히 보기"
										>
											<ExternalLink class="h-4 w-4" />
										</button>
									</div>
									<div class="flex items-center justify-between text-xs text-gray-500">
										<span>{notice.proposerCategory} | {notice.committee}</span>
										<span>의견 {notice.numComments}개</span>
									</div>
									<div class="mt-1 text-xs text-gray-400">
										의안번호: {notice.num}
									</div>
								</div>
							{/each}
						</div>

						{#if recentNotices.length > 5}
							<div class="mt-4 text-center">
								<a
									href="./notices"
									class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
								>
									<Plus class="mr-1 h-4 w-4" />
									{recentNotices.length - 5}개 더 보기
								</a>
							</div>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Stats Section -->
			<div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="rounded-lg bg-white p-4 shadow">
					<h3 class="text-sm font-medium text-gray-600">등록된 웹훅</h3>
					<p class="text-2xl font-bold text-blue-600">{stats.webhooks.active.toLocaleString()}</p>
					<p class="text-xs text-gray-500">활성 / 총 {stats.webhooks.total.toLocaleString()}개</p>
				</div>
				<div class="rounded-lg bg-white p-4 shadow">
					<h3 class="text-sm font-medium text-gray-600">캐시된 입법예고</h3>
					<p class="text-2xl font-bold text-green-600">{stats.cache.size}</p>
					<p class="text-xs text-gray-500">최대 {stats.cache.maxSize}개</p>
				</div>
				<div class="rounded-lg bg-white p-4 shadow">
					<h3 class="text-sm font-medium text-gray-600">마지막 업데이트</h3>
					<p class="text-sm font-medium text-gray-900">
						{stats.cache.lastUpdated ? formatDate(stats.cache.lastUpdated) : '없음'}
					</p>
				</div>
			</div>

			<!-- Info Section -->
			<div class="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4">
				<h3 class="text-md mb-2 font-medium text-blue-900">서비스 안내</h3>
				<ul class="space-y-1 text-sm text-blue-800">
					<li>• 10분마다 자동으로 새로운 입법예고를 확인합니다</li>
					<li>• 새로운 입법예고 발견 시 Discord 웹훅으로 알림을 전송합니다</li>
					<li>• 로그인 없이 간단하게 Discord 웹훅 URL만 등록하면 됩니다</li>
				</ul>
			</div>
		{/if}
	</main>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
