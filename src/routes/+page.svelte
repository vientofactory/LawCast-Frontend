<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, Bell, Plus, ExternalLink, RefreshCw, Loader2 } from 'lucide-svelte';
	import axios from 'axios';
	import { PUBLIC_VITE_API_BASE_URL } from '$env/static/public';
	import { browser } from '$app/environment';

	const API_BASE = PUBLIC_VITE_API_BASE_URL || 'http://localhost:3001/api';
	const RECAPTCHA_SITE_KEY = browser ? (import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY as string) || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI' : '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

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
	let stats = { webhooks: { total: 0, active: 0, inactive: 0 }, cache: { size: 0, lastUpdated: null, maxSize: 50 } };
	let newWebhookUrl = '';
	let recaptchaToken = '';

	let isInitialLoading = true;
	let isSubmitting = false;
	let isManualChecking = false;
	let error = '';
	let success = '';

	onMount(async () => {
		try {
			await Promise.all([
				loadRecentNotices(),
				loadStats()
			]);
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
			(window as any).onRecaptchaLoad = () => {
				recaptchaLoaded = true;
				renderRecaptcha();
			};
		}
	}

	function renderRecaptcha() {
		if (typeof window !== 'undefined' && (window as any).grecaptcha && recaptchaLoaded) {
			const container = document.getElementById('recaptcha-container');
			if (container && recaptchaWidgetId === null) {
				recaptchaWidgetId = (window as any).grecaptcha.render('recaptcha-container', {
					'sitekey': RECAPTCHA_SITE_KEY,
					'callback': (token: string) => {
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
		if (typeof window !== 'undefined' && (window as any).grecaptcha && recaptchaWidgetId !== null) {
			(window as any).grecaptcha.reset(recaptchaWidgetId);
			recaptchaToken = '';
		}
	}

	async function addWebhook() {
		if (!newWebhookUrl.trim()) {
			error = '웹훅 URL을 입력해주세요.';
			return;
		}

		if (!newWebhookUrl.includes('discord.com/api/webhooks/')) {
			error = '올바른 Discord 웹훅 URL을 입력해주세요.';
			return;
		}

		if (!recaptchaToken) {
			error = 'reCAPTCHA 인증을 완료해주세요.';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';

		try {
			const response = await axios.post(`${API_BASE}/webhooks`, {
				url: newWebhookUrl,
				recaptchaToken
			});

			success = response.data.message;
			newWebhookUrl = '';
			resetRecaptcha();
			await loadStats(); // 통계 업데이트
		} catch (err: any) {
			error = err.response?.data?.message || '웹훅 등록에 실패했습니다.';
			resetRecaptcha();
		} finally {
			isSubmitting = false;
		}
	}

	async function refreshData() {
		isManualChecking = true;
		error = '';
		success = '';

		try {
			await Promise.all([
				loadRecentNotices(),
				loadStats()
			]);
			success = '데이터를 새로고침했습니다.';
		} catch (err) {
			error = '데이터 새로고침에 실패했습니다.';
		} finally {
			isManualChecking = false;
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
</script>

<svelte:head>
	<title>LawCast - 국회 입법예고 알리미</title>
	<meta name="description" content="국회 입법예고 변동사항을 디스코드로 알려드립니다." />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white shadow-sm border-b">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center py-6">
				<div class="flex items-center space-x-3">
					<div class="p-2 bg-blue-100 rounded-lg">
						<Bell class="h-8 w-8 text-blue-600" />
					</div>
					<div>
						<h1 class="text-2xl font-bold text-gray-900">LawCast</h1>
						<p class="text-sm text-gray-600">국회 입법예고 디스코드 알리미</p>
					</div>
				</div>
				<button
					on:click={refreshData}
					disabled={isManualChecking || isInitialLoading}
					class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					<RefreshCw class="h-4 w-4 mr-2 {isManualChecking ? 'animate-spin' : ''}" />
					{isManualChecking ? '새로고침 중...' : '데이터 새로고침'}
				</button>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
		<!-- Initial Loading State -->
		{#if isInitialLoading}
			<div class="flex items-center justify-center py-16">
				<div class="text-center">
					<Loader2 class="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
					<p class="text-gray-600">데이터를 불러오는 중...</p>
				</div>
			</div>
		{:else}
		<!-- Messages -->
		{#if error}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<AlertTriangle class="h-5 w-5 text-red-600 mr-2" />
						<span class="text-red-800">{error}</span>
					</div>
					<div class="flex space-x-2">
						{#if error.includes('초기 데이터')}
							<button 
								on:click={() => location.reload()} 
								class="text-red-600 hover:text-red-800 text-sm underline"
							>
								새로고침
							</button>
						{/if}
						<button on:click={clearMessage} class="text-red-600 hover:text-red-800 text-lg">×</button>
					</div>
				</div>
			</div>
		{/if}

		{#if success}
			<div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
				<div class="flex items-center">
					<div class="h-5 w-5 text-green-600 mr-2">✓</div>
					<span class="text-green-800">{success}</span>
					<button on:click={clearMessage} class="ml-auto text-green-600 hover:text-green-800">×</button>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Webhook Registration -->
			<div class="bg-white rounded-lg shadow p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
					<Plus class="h-5 w-5 mr-2" />
					웹훅 등록
				</h2>
				
				<form on:submit|preventDefault={addWebhook} class="space-y-4">
					<div>
						<label for="webhook-url" class="block text-sm font-medium text-gray-700 mb-2">
							Discord 웹훅 URL *
						</label>
						<input
							id="webhook-url"
							type="url"
							bind:value={newWebhookUrl}
							placeholder="https://discord.com/api/webhooks/..."
							class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
							required
						/>
					</div>
					
					<!-- reCAPTCHA -->
					<div>
						<div id="recaptcha-container" class="mb-4"></div>
						{#if !recaptchaLoaded}
							<div class="text-sm text-gray-500 mb-2">
								<Loader2 class="inline h-4 w-4 animate-spin mr-1" />
								reCAPTCHA 로딩 중...
							</div>
						{/if}
					</div>
					
					<button
						type="submit"
						disabled={isSubmitting || isInitialLoading}
						class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center transition-colors"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin mr-2" />
							등록 중...
						{:else}
							<Plus class="h-4 w-4 mr-2" />
							웹훅 등록
						{/if}
					</button>
				</form>


			</div>

			<!-- Recent Notices -->
			<div class="bg-white rounded-lg shadow p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">
					최근 입법예고 ({recentNotices.length})
				</h2>
				
				{#if recentNotices.length === 0}
					<div class="text-center py-8">
						<div class="text-gray-400 mb-2">
							<Bell class="h-8 w-8 mx-auto" />
						</div>
						<p class="text-gray-500">아직 수집된 입법예고가 없습니다.</p>
						<p class="text-gray-400 text-sm mt-1">서버가 시작되면 자동으로 데이터를 수집합니다.</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each recentNotices.slice(0, 10) as notice}
							<div class="border border-gray-200 rounded-md p-3">
								<div class="flex justify-between items-start mb-2">
									<h3 class="text-sm font-medium text-gray-900 line-clamp-2">
										{notice.subject}
									</h3>
									<a
										href={notice.link}
										target="_blank"
										rel="noopener noreferrer"
										class="text-blue-600 hover:text-blue-800 ml-2"
										title="자세히 보기"
									>
										<ExternalLink class="h-4 w-4" />
									</a>
								</div>
								<div class="flex justify-between items-center text-xs text-gray-500">
									<span>{notice.proposerCategory} | {notice.committee}</span>
									<span>의견 {notice.numComments}개</span>
								</div>
							<div class="text-xs text-gray-400 mt-1">
								의안번호: {notice.num}
							</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Stats Section -->
		<div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="bg-white rounded-lg shadow p-4">
				<h3 class="text-sm font-medium text-gray-600">등록된 웹훅</h3>
				<p class="text-2xl font-bold text-blue-600">{stats.webhooks.active}</p>
				<p class="text-xs text-gray-500">활성 / 총 {stats.webhooks.total}개</p>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<h3 class="text-sm font-medium text-gray-600">캐시된 입법예고</h3>
				<p class="text-2xl font-bold text-green-600">{stats.cache.size}</p>
				<p class="text-xs text-gray-500">최대 {stats.cache.maxSize}개</p>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<h3 class="text-sm font-medium text-gray-600">마지막 업데이트</h3>
				<p class="text-sm font-medium text-gray-900">
					{stats.cache.lastUpdated ? formatDate(stats.cache.lastUpdated) : '없음'}
				</p>
			</div>
		</div>

		<!-- Info Section -->
		<div class="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
			<h3 class="text-md font-medium text-blue-900 mb-2">서비스 안내</h3>
			<ul class="text-sm text-blue-800 space-y-1">
				<li>• 10분마다 자동으로 새로운 입법예고를 확인합니다</li>
				<li>• 새로운 입법예고 발견 시 Discord 웹훅으로 알림을 전송합니다</li>
				<li>• 로그인 없이 간단하게 Discord 웹훅 URL만 등록하면 됩니다</li>
				<li>• reCAPTCHA 인증을 통해 스팸 방지 기능을 제공합니다</li>
				<li>• 등록된 웹훅은 비공개로 처리되며 목록에 표시되지 않습니다</li>
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
