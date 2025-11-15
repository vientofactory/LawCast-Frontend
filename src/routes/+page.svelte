<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import WebhookRegistrationForm from '$lib/components/WebhookRegistrationForm.svelte';
	import RecentNotices from '$lib/components/RecentNotices.svelte';
	import SystemStats from '$lib/components/SystemStats.svelte';
	import ServiceInfo from '$lib/components/ServiceInfo.svelte';
	import { apiClient } from '$lib/api/client';
	import type { Notice, SystemStats as SystemStatsType } from '$lib/types/api';

	let recentNotices: Notice[] = [];
	let stats: SystemStatsType = {
		webhooks: { total: 0, active: 0, inactive: 0 },
		cache: { size: 0, lastUpdated: null, maxSize: 50 }
	};

	let isInitialLoading = true;
	let error = '';
	let success = '';

	onMount(async () => {
		try {
			await Promise.all([loadRecentNotices(), loadStats()]);
		} catch (err) {
			console.error('Failed to load initial data:', err);
			error = '초기 데이터 로딩에 실패했습니다. 페이지를 새로고침해주세요.';
		} finally {
			isInitialLoading = false;
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

	function clearMessage() {
		error = '';
		success = '';
	}

	function handleWebhookError(event: CustomEvent<string>) {
		error = event.detail;
	}

	function handleWebhookSuccess(event: CustomEvent<string>) {
		success = event.detail;
	}

	async function handleWebhookRegistered() {
		await loadStats(); // 통계 업데이트
	}
</script>

<svelte:head>
	<title>LawCast - 국회 입법예고 알리미</title>
	<meta name="description" content="국회 입법예고 변동사항을 디스코드로 알려드립니다." />
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
	<Header />

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Initial Loading State -->
		{#if isInitialLoading}
			<LoadingSpinner />
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
				class="rounded-lg border-l-4 border-blue-300 bg-linear-to-r from-blue-50/50 to-indigo-50/30 p-4 leading-relaxed font-medium text-slate-600 italic"
			>
				게임에 잠수함 패치는 있을 수 있지만, 법안에 잠수함 패치는 있을 수 없습니다.<br />
				모든 사람들이 입법예고의 투명한 감시 권리를 가질 수 있는 그 날까지 LawCast는 함께합니다.
			</blockquote>

			<div class="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
				<!-- Webhook Registration -->
				<WebhookRegistrationForm
					{isInitialLoading}
					on:error={handleWebhookError}
					on:success={handleWebhookSuccess}
					on:clearMessage={clearMessage}
					on:webhookRegistered={handleWebhookRegistered}
				/>

				<!-- Recent Notices -->
				<RecentNotices notices={recentNotices} />
			</div>

			<!-- Stats Section -->
			<div class="mt-8">
				<SystemStats {stats} />
			</div>

			<!-- Info Section -->
			<div class="mt-8">
				<ServiceInfo />
			</div>
		{/if}
	</main>
</div>

<style>
	/* 더 부드러운 호버 효과를 위한 커스텀 스타일 */
	:global(.group:hover .transition-colors) {
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
