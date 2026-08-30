<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faDatabase,
		faGlobe,
		faArrowRight,
		faCodeCompare,
		faCalendarCheck,
		faInfoCircle,
		faExclamationTriangle,
		faScaleBalanced
	} from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';
	import type { CrawlingTransparencyData } from '$lib/types/api';
	import { formatDateTimeKST } from '$lib/utils/helpers';

	export let data: PageData;

	$: transparency = data.transparency as CrawlingTransparencyData;
	$: fetchedAt = data.fetchedAt;
	$: error = data.error;

	function formatNumber(n: number): string {
		return n.toLocaleString('ko-KR');
	}

	function formatInterval(ms: number): string {
		if (ms <= 0) return '-';
		const min = Math.floor(ms / 60_000);
		return min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`;
	}

	const EVENT_TYPE_LABEL: Record<string, string> = {
		created: '신규 수집',
		updated: '변경 감지',
		invalidated: '정보 무효화'
	};

	const EVENT_SOURCE_LABEL: Record<string, string> = {
		'archive:upsert': '입법예고 수집·동기화',
		'archive:isDoneSync': '입법예고 종료 확인',
		'archive:source-missing': '원본 삭제 감지',
		'archive:updateNsmHtmlAndDetail': '입법진행현황 상세 갱신',
		'bootstrap:legacy-seed': '기존 데이터 변경 이력 초기화'
	};

	const LIFECYCLE_LABEL: Record<string, string> = {
		active: '활성',
		source_deleted: '원본 삭제됨',
		renumbered: '번호 변경됨'
	};
</script>

<svelte:head>
	<title>LawCast - 투명성 정보</title>
	<meta
		name="description"
		content="LawCast의 크롤링 소스, 수집 데이터, 의안 이관 흐름 등 운영 투명성 정보입니다."
	/>
</svelte:head>

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Hero -->
		<div class="lc-panel-hero mb-6 rounded-2xl border p-5">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="lc-text-info text-xs font-semibold tracking-wide">TRANSPARENCY</p>
					<h1 class="lc-text-primary mt-1 text-2xl font-bold">투명성 정보</h1>
					<p class="lc-text-secondary mt-1 text-sm">
						데이터가 어디서 오고, 어떤 과정을 거쳐 수집·관리되는지 투명하게 공개합니다.
					</p>
				</div>
				<p class="lc-text-dim text-xs">
					마지막 조회: <span class="lc-text-primary font-semibold"
						>{formatDateTimeKST(fetchedAt)}</span
					>
				</p>
			</div>
		</div>

		{#if error}
			<div
				class="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
			>
				<FontAwesomeIcon icon={faExclamationTriangle} class="mr-2 h-4 w-4" />
				{error}
			</div>
		{/if}

		<!-- ── 데이터 수집 소스 ────────────────────────────────────────── -->
		<section class="lc-panel-card rounded-2xl border p-5 shadow-sm">
			<h2 class="lc-text-primary mb-4 flex items-center text-sm font-bold">
				<FontAwesomeIcon icon={faGlobe} class="lc-text-accent mr-2 h-4 w-4" />
				데이터 수집 소스
			</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each transparency.noticeSources as source (source.id)}
					<div class="rounded-xl border border-(--lc-border-soft) p-4">
						<h3 class="lc-text-primary mb-2 text-sm font-bold">{source.name}</h3>
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							class="lc-text-info mb-2 inline-flex items-center gap-1 text-xs hover:underline"
						>
							{source.url.replace('https://', '')}
							<FontAwesomeIcon icon={faGlobe} class="h-3 w-3" />
						</a>
						<p class="lc-text-secondary mb-3 text-xs leading-relaxed">{source.description}</p>
						<div class="lc-text-secondary space-y-1 text-xs">
							<p>
								수집된 의안:
								<span class="lc-text-primary font-semibold"
									>{formatNumber(source.noticeCount)}건</span
								>
							</p>
							<p>
								수집 주기:
								<span class="lc-text-primary font-semibold"
									>{formatInterval(source.intervalMs)}</span
								>
								<span class="lc-text-muted ml-1">({source.intervalLabel})</span>
							</p>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- ── 수집 데이터 현황 ─────────────────────────────────────────── -->
		<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
			<h2 class="lc-text-primary mb-4 flex items-center text-sm font-bold">
				<FontAwesomeIcon icon={faDatabase} class="lc-text-success mr-2 h-4 w-4" />
				수집 데이터 현황
			</h2>

			<div class="mb-4 rounded-xl border border-(--lc-border-soft) p-4">
				<p class="lc-text-muted mb-1 text-xs font-semibold">전체 수집 의안 수</p>
				<p class="lc-text-primary text-2xl font-bold">
					{formatNumber(transparency.collection.totalNotices)}
				</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<!-- 의안 상태별 -->
				<div class="rounded-xl border border-(--lc-border-soft) p-4">
					<h3 class="lc-text-primary mb-2 text-xs font-bold">의안 상태</h3>
					<div class="lc-text-secondary space-y-1.5 text-xs">
						{#each Object.entries(transparency.collection.byLifecycle) as [status, count] (status)}
							<div class="flex items-center justify-between">
								<span>{LIFECYCLE_LABEL[status] ?? status}</span>
								<span class="lc-text-primary font-semibold">{formatNumber(count)}건</span>
							</div>
						{/each}
						{#if Object.keys(transparency.collection.byLifecycle).length === 0}
							<p class="lc-text-muted">데이터 없음</p>
						{/if}
					</div>
				</div>

				<!-- 수집 경로별 -->
				<div class="rounded-xl border border-(--lc-border-soft) p-4">
					<h3 class="lc-text-primary mb-2 text-xs font-bold">수집 경로별 이벤트</h3>
					<div class="lc-text-secondary space-y-1.5 text-xs">
						{#each Object.entries(transparency.collection.bySource) as [source, count] (source)}
							<div class="flex items-center justify-between">
								<span>{EVENT_SOURCE_LABEL[source] ?? source}</span>
								<span class="lc-text-primary font-semibold">{formatNumber(count)}건</span>
							</div>
						{/each}
						{#if Object.keys(transparency.collection.bySource).length === 0}
							<p class="lc-text-muted">데이터 없음</p>
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- ── 변경 추적 현황 ──────────────────────────────────────────── -->
		<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
			<h2 class="lc-text-primary mb-4 flex items-center text-sm font-bold">
				<FontAwesomeIcon icon={faCodeCompare} class="lc-text-info mr-2 h-4 w-4" />
				변경 추적 현황
			</h2>
			<div class="mb-3 rounded-xl border border-(--lc-border-soft) p-4">
				<p class="lc-text-muted mb-1 text-xs font-semibold">감지된 전체 변경 건수</p>
				<p class="lc-text-primary text-2xl font-bold">
					{formatNumber(transparency.changeTracking.totalEvents)}
				</p>
			</div>
			<div class="rounded-xl border border-(--lc-border-soft) p-4">
				<h3 class="lc-text-primary mb-2 text-xs font-bold">변경 유형별</h3>
				<div class="lc-text-secondary space-y-1.5 text-xs">
					{#each Object.entries(transparency.changeTracking.byType) as [type, count] (type)}
						<div class="flex items-center justify-between">
							<span>{EVENT_TYPE_LABEL[type] ?? type}</span>
							<span class="lc-text-primary font-semibold">{formatNumber(count)}건</span>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- ── 수집 스케줄 ───────────────────────────────────────────── -->
		<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
			<h2 class="lc-text-primary mb-4 flex items-center text-sm font-bold">
				<FontAwesomeIcon icon={faCalendarCheck} class="lc-text-accent mr-2 h-4 w-4" />
				자동 수집 스케줄
			</h2>
			<div class="space-y-3">
				{#each transparency.schedules as schedule (schedule.id)}
					<div class="rounded-xl border border-(--lc-border-soft) px-4 py-3">
						<div class="mb-1 flex items-center justify-between">
							<span class="lc-text-primary text-xs font-bold">{schedule.name}</span>
							<span class="lc-chip-blue rounded-full border px-2 py-0.5 text-[10px] font-semibold">
								{formatInterval(schedule.intervalMs)}
							</span>
						</div>
						<p class="lc-text-secondary text-xs">{schedule.description}</p>
						<p class="lc-text-muted mt-1 text-[11px]">{schedule.intervalLabel}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- ── 의안 이관 흐름 ────────────────────────────────────────────── -->
		<section class="lc-panel-card mt-4 rounded-2xl border p-5 shadow-sm">
			<h2 class="lc-text-primary mb-4 flex items-center text-sm font-bold">
				<FontAwesomeIcon icon={faArrowRight} class="lc-text-info mr-2 h-4 w-4" />
				의안 이관 흐름
			</h2>
			<div class="rounded-xl border border-(--lc-border-soft) p-4">
				<p class="lc-text-secondary mb-4 text-sm leading-relaxed">
					{transparency.transferFlow.description}
				</p>

				<div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<div class="rounded-xl border border-(--lc-border-soft) px-4 py-3 text-center">
						<p class="lc-text-primary text-xs font-bold">국민참여입법센터</p>
						<p class="lc-text-muted mt-1 text-[11px]">입법진행현황(국회입법현황)</p>
					</div>

					<FontAwesomeIcon
						icon={faArrowRight}
						class="lc-text-accent h-5 w-5 rotate-90 sm:rotate-0"
					/>

					<div class="rounded-xl border border-(--lc-border-soft) px-4 py-3 text-center">
						<p class="lc-text-primary text-xs font-bold">LawCast 자동 수집</p>
						<p class="lc-text-muted mt-1 text-[11px]">수집 완료 후 아카이브</p>
					</div>

					<FontAwesomeIcon
						icon={faArrowRight}
						class="lc-text-accent h-5 w-5 rotate-90 sm:rotate-0"
					/>

					<div class="rounded-xl border border-(--lc-border-soft) px-4 py-3 text-center">
						<p class="lc-text-primary text-xs font-bold">국회 입법예고</p>
						<p class="lc-text-muted mt-1 text-[11px]">의안으로 등록되어 관리</p>
					</div>
				</div>

				<p class="lc-text-muted mt-4 text-center text-[11px]">
					{transparency.transferFlow.nsmToPalIndicator}
				</p>
			</div>
		</section>

		<!-- ── 안내 ──────────────────────────────────────────────────── -->
		<div class="lc-panel-card mt-4 rounded-2xl border p-4 text-center">
			<p class="lc-text-dim flex items-center justify-center gap-1 text-xs">
				<FontAwesomeIcon icon={faInfoCircle} class="h-3 w-3" />
				이 페이지의 수치는 서버 데이터베이스에서 직접 집계된 실제 값입니다. 매 시간 자동 갱신됩니다.
			</p>
		</div>
	</main>
</div>
