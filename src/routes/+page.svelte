<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Bell, Plus, ExternalLink, Loader2, ChevronRight, HelpCircle } from 'lucide-svelte';
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import { apiClient } from '$lib/api/client';
	import type { Notice, SystemStats } from '$lib/types/api';
	import {
		validateDiscordWebhookUrl,
		normalizeWebhookUrl,
		formatDate,
		openExternalLink
	} from '$lib/utils/helpers';

	const RECAPTCHA_SITE_KEY_VAL = PUBLIC_RECAPTCHA_SITE_KEY || '';

	let recaptchaLoaded = false;
	let recaptchaWidgetId: number | null = null;

	let recentNotices: Notice[] = [];
	let stats: SystemStats = {
		webhooks: { total: 0, active: 0, inactive: 0 },
		cache: { size: 0, lastUpdated: null, maxSize: 50 }
	};
	let newWebhookUrl = '';
	let recaptchaToken = '';

	let isInitialLoading = true;
	let isSubmitting = false;
	let error = '';
	let success = '';
	let isHelpExpanded = false;

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
			recentNotices = await apiClient.getRecentNotices();
		} catch (err) {
			console.error('Failed to load recent notices:', err);
			// 에러는 상위에서 처리
		}
	}

	async function loadStats() {
		try {
			stats = await apiClient.getSystemStats();
		} catch (err) {
			console.error('Failed to load stats:', err);
			// 에러는 상위에서 처리
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

			const result = await apiClient.registerWebhook({
				url: normalizedUrl,
				recaptchaToken: recaptchaToken.trim()
			});

			if (result.success) {
				success = result.message || '웹훅이 성공적으로 등록되었습니다.';
				newWebhookUrl = '';
				resetRecaptcha();
				await loadStats(); // 통계 업데이트
			} else {
				error = result.message || '웹훅 등록에 실패했습니다.';
				resetRecaptcha();
			}
		} catch (err: unknown) {
			resetRecaptcha();

			if (err instanceof Error) {
				error = err.message;
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
</script>

<svelte:head>
	<title>LawCast - 국회 입법예고 알리미</title>
	<meta name="description" content="국회 입법예고 변동사항을 디스코드로 알려드립니다." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
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
				<Alert
					type="error"
					message={error}
					showRefresh={error.includes('초기 데이터')}
					onDismiss={clearMessage}
					onRefresh={() => location.reload()}
				/>
			{/if}

			{#if success}
				<Alert
					type="success"
					message={success}
					autoHide={true}
					autoHideDelay={4000}
					onDismiss={clearMessage}
				/>
			{/if}

			<blockquote
				class="rounded-lg border-l-4 border-blue-300 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 p-4 leading-relaxed font-medium text-slate-600 italic"
			>
				게임에 잠수함 패치는 있을 수 있지만, 법안에 잠수함 패치는 있을 수 없습니다.<br />
				모든 사람들이 입법예고의 투명한 감시 권리를 가질 수 있는 그 날까지 LawCast는 함께합니다.
			</blockquote>

			<div class="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
				<!-- Webhook Registration -->
				<div
					class="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-lg shadow-blue-100/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/60"
				>
					<h2 class="mb-6 flex items-center text-xl font-bold tracking-tight text-gray-800">
						<div class="mr-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 p-2">
							<Plus class="h-5 w-5 text-white" />
						</div>
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
								class="w-full rounded-xl border-2 border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-700 shadow-sm transition-all duration-200 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:outline-none"
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
							class="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-300/60 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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

					<!-- Discord Webhook Guide -->
					<div class="mt-6 border-t border-gray-200 pt-6">
						<button
							type="button"
							on:click={() => (isHelpExpanded = !isHelpExpanded)}
							class="group flex w-full items-center justify-between rounded-lg bg-gray-50/80 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100/80 hover:shadow-sm focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 focus:outline-none"
						>
							<div class="flex items-center">
								<div
									class="mr-2 rounded-md bg-blue-100 p-1 transition-colors duration-200 group-hover:bg-blue-200"
								>
									<HelpCircle
										class="h-4 w-4 text-blue-600 transition-colors duration-200 group-hover:text-blue-700"
									/>
								</div>
								<span
									class="text-sm font-medium text-gray-700 transition-colors duration-200 group-hover:text-gray-800"
								>
									Discord 웹훅 생성 방법 안내
								</span>
							</div>
							<div
								class="transition-transform duration-300 ease-out {isHelpExpanded
									? 'rotate-90'
									: 'rotate-0'}"
							>
								<ChevronRight
									class="h-4 w-4 text-gray-500 transition-colors duration-200 group-hover:text-gray-600"
								/>
							</div>
						</button>

						{#if isHelpExpanded}
							<div
								class="mt-4 overflow-hidden rounded-lg border border-blue-100 bg-blue-50/30 p-4"
								transition:slide={{ duration: 400, easing: cubicOut }}
								style="transform-origin: top;"
							>
								<h4 class="mb-3 text-sm font-semibold text-blue-800">
									Discord 웹훅 생성 단계별 가이드
								</h4>
								<ol class="space-y-2 text-sm text-gray-700">
									<li class="flex items-start">
										<span
											class="mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white"
										>
											1
										</span>
										<div>
											<strong>Discord 서버에서 채널 선택:</strong>
											알림을 받고 싶은 텍스트 채널로 이동합니다.
										</div>
									</li>
									<li class="flex items-start">
										<span
											class="mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white"
										>
											2
										</span>
										<div>
											<strong>채널 설정 열기:</strong>
											채널 이름 옆의 ⚙️ 아이콘을 클릭하거나, 채널을 우클릭하여 "채널 편집"을 선택합니다.
										</div>
									</li>
									<li class="flex items-start">
										<span
											class="mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white"
										>
											3
										</span>
										<div>
											<strong>연동 탭 선택:</strong>
											좌측 메뉴에서 "연동(Integrations)" 탭을 클릭합니다.
										</div>
									</li>
									<li class="flex items-start">
										<span
											class="mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white"
										>
											4
										</span>
										<div>
											<strong>웹훅 생성:</strong>
											"웹훅 보기" 또는 "웹훅 만들기" 버튼을 클릭합니다.
										</div>
									</li>
									<li class="flex items-start">
										<span
											class="mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white"
										>
											5
										</span>
										<div>
											<strong>웹훅 URL 복사:</strong>
											생성된 웹훅의 "웹훅 URL 복사" 버튼을 클릭하여 URL을 복사합니다.
										</div>
									</li>
									<li class="flex items-start">
										<span
											class="mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white"
										>
											✓
										</span>
										<div>
											<strong>완료:</strong>
											복사한 URL을 위의 입력 필드에 붙여넣고 등록하세요!
										</div>
									</li>
								</ol>

								<div class="mt-4 rounded-md border border-amber-200 bg-amber-50/50 p-3">
									<div class="flex items-start">
										<div class="mt-0.5 mr-2">
											<div class="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
										</div>
										<div class="text-xs text-amber-700">
											<strong>참고:</strong>
											웹훅 URL은
											<code class="rounded bg-amber-100 px-1 py-0.5 text-amber-800">
												https://discord.com/api/webhooks/
											</code>
											또는
											<code class="rounded bg-amber-100 px-1 py-0.5 text-amber-800">
												https://discordapp.com/api/webhooks/
											</code>
											로 시작해야 합니다.
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Recent Notices -->
				<div
					class="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-lg shadow-green-100/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-green-100/60"
				>
					<div class="mb-6 flex items-center justify-between">
						<h2 class="flex items-center text-xl font-bold tracking-tight text-gray-800">
							<div class="mr-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 p-2">
								<Bell class="h-5 w-5 text-white" />
							</div>
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
								<div
									class="group rounded-xl border border-gray-100 bg-gradient-to-r from-gray-50/50 to-blue-50/30 p-4 transition-all duration-200 hover:from-blue-50/60 hover:to-indigo-50/40 hover:shadow-md"
								>
									<div class="mb-3 flex items-start justify-between">
										<h3
											class="line-clamp-2 text-sm leading-relaxed font-semibold text-gray-800 group-hover:text-gray-900"
										>
											{notice.subject}
										</h3>
										<button
											on:click={() => openExternalLink(notice.link)}
											class="ml-3 shrink-0 rounded-lg bg-blue-100/80 p-2 text-blue-600 transition-all duration-200 hover:scale-105 hover:bg-blue-200 hover:text-blue-700"
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
			<div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
				<div
					class="rounded-2xl border border-blue-200/30 bg-gradient-to-br from-blue-50 to-indigo-100/60 p-6 shadow-lg shadow-blue-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200/60"
				>
					<h3 class="mb-2 text-sm font-semibold text-blue-700">등록된 웹훅</h3>
					<p class="mb-1 text-3xl font-bold text-blue-600">
						{stats.webhooks.active.toLocaleString()}
					</p>
					<p class="text-xs text-blue-500/80">
						활성 / 총 {stats.webhooks.total.toLocaleString()}개
					</p>
				</div>
				<div
					class="rounded-2xl border border-green-200/30 bg-gradient-to-br from-green-50 to-emerald-100/60 p-6 shadow-lg shadow-green-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-200/60"
				>
					<h3 class="mb-2 text-sm font-semibold text-green-700">캐시된 입법예고</h3>
					<p class="mb-1 text-3xl font-bold text-green-600">{stats.cache.size}</p>
					<p class="text-xs text-green-500/80">최대 {stats.cache.maxSize}개</p>
				</div>
				<div
					class="rounded-2xl border border-purple-200/30 bg-gradient-to-br from-purple-50 to-pink-100/60 p-6 shadow-lg shadow-purple-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-200/60"
				>
					<h3 class="mb-2 text-sm font-semibold text-purple-700">마지막 업데이트</h3>
					<p class="text-lg font-bold text-purple-600">
						{stats.cache.lastUpdated ? formatDate(stats.cache.lastUpdated) : '없음'}
					</p>
				</div>
			</div>

			<!-- Info Section -->
			<div
				class="mt-8 rounded-2xl border border-blue-200/40 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/40 p-6 shadow-lg shadow-blue-100/30 backdrop-blur-sm"
			>
				<h3 class="mb-4 flex items-center text-lg font-bold text-blue-900">
					<div class="mr-2 rounded-lg bg-blue-200/50 p-1.5">
						<Bell class="h-4 w-4 text-blue-700" />
					</div>
					서비스 안내
				</h3>
				<ul class="space-y-3 text-sm text-blue-800">
					<li class="flex items-start">
						<span class="mt-0.5 mr-3 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
						10분마다 자동으로 새로운 입법예고를 확인합니다
					</li>
					<li class="flex items-start">
						<span class="mt-0.5 mr-3 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
						새로운 입법예고 발견 시 Discord 웹훅으로 알림을 전송합니다
					</li>
					<li class="flex items-start">
						<span class="mt-0.5 mr-3 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
						로그인 없이 간단하게 Discord 웹훅 URL만 등록하면 됩니다
					</li>
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

	/* 더 부드러운 호버 효과를 위한 커스텀 스타일 */
	:global(.group:hover .transition-colors) {
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
