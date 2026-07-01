<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faScaleBalanced, faServer, faDesktop } from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';

	export let data: PageData;

	$: ({ backendPackages, frontendPackages } = data);

	const licenseBadgeStyle: Record<string, string> = {
		MIT: 'lc-chip-success',
		'Apache-2.0': 'lc-chip-info',
		'BSD-3-Clause': 'lc-chip-purple',
		'OFL-1.1': 'lc-chip-warning',
		'CC-BY-4.0 AND MIT': 'lc-chip-warning',
		'MIT OR GPL-3.0-or-later': 'lc-chip-teal'
	};

	function badgeStyle(license: string): string {
		return licenseBadgeStyle[license] ?? 'lc-chip-muted';
	}
</script>

<svelte:head>
	<title>LawCast - 라이선스</title>
	<meta
		name="description"
		content="LawCast 프로젝트의 라이선스 고지 및 오픈소스 라이선스 안내 페이지입니다."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="LawCast - 라이선스" />
	<meta
		property="og:description"
		content="LawCast 프로젝트의 라이선스 고지 및 오픈소스 라이선스 안내 페이지입니다."
	/>
	<meta name="twitter:title" content="LawCast - 라이선스" />
	<meta
		name="twitter:description"
		content="LawCast 프로젝트의 라이선스 고지 및 오픈소스 라이선스 안내 페이지입니다."
	/>
</svelte:head>

<div class="page-shell">
	<Header />

	<main id="main-content" class="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- 페이지 헤더 -->
		<div class="lc-panel-hero mb-6 rounded-2xl border p-5">
			<p class="lc-text-purple text-xs font-semibold tracking-wide">LICENSE</p>
			<h1 class="lc-text-primary mt-1 flex items-center gap-2 text-2xl font-bold">
				<FontAwesomeIcon icon={faScaleBalanced} class="lc-text-purple h-6 w-6" />
				라이선스 고지
			</h1>
			<p class="lc-text-secondary mt-1 text-sm">
				LawCast 프로젝트의 라이선스 및 사용된 오픈소스 패키지의 라이선스 고지입니다.
			</p>
		</div>

		<!-- LawCast 프로젝트 라이선스 -->
		<section class="lc-panel-card mb-6 rounded-2xl border p-5">
			<h2 class="lc-text-primary mb-3 text-base font-bold">LawCast 프로젝트 라이선스</h2>
			<p class="lc-text-secondary mb-3 text-sm">
				LawCast는 <span class="lc-text-purple font-semibold">MIT License</span> 하에 배포됩니다.
			</p>
			<pre
				class="lc-code-block overflow-x-auto rounded-xl border p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">MIT License

Copyright (c) 2025 Viento

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.</pre>
		</section>

		<!-- 오픈소스 라이선스 고지 -->
		<section class="lc-panel-card mb-6 rounded-2xl border p-5">
			<h2 class="lc-text-primary mb-1 text-base font-bold">오픈소스 라이선스 고지</h2>
			<p class="lc-text-muted mb-5 text-sm">
				이 소프트웨어는 아래 오픈소스 패키지를 사용합니다. 각 패키지의 라이선스 조건을 준수합니다.
			</p>

			<!-- 백엔드 -->
			<div class="mb-6">
				<h3
					class="lc-text-primary mb-3 flex items-center gap-2 border-b border-[var(--lc-border-soft)] pb-2 text-sm font-bold"
				>
					<FontAwesomeIcon icon={faServer} class="lc-text-muted h-3.5 w-3.5" />
					백엔드 (NestJS)
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full min-w-120 border-collapse text-sm">
						<thead>
							<tr class="lc-text-muted border-b border-[var(--lc-border-soft)] text-xs">
								<th class="py-2 pr-4 text-left font-semibold">패키지</th>
								<th class="py-2 pr-4 text-left font-semibold">버전</th>
								<th class="py-2 text-left font-semibold">라이선스</th>
							</tr>
						</thead>
						<tbody>
							{#each backendPackages as pkg (pkg.name)}
								<tr class="lc-table-row border-b">
									<td class="lc-text-secondary py-2 pr-4 font-mono text-xs">
										{pkg.name}
									</td>
									<td class="lc-text-dim py-2 pr-4 font-mono text-xs">{pkg.version}</td>
									<td class="py-2">
										<span
											class={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyle(pkg.license)}`}
										>
											{pkg.license}
										</span>
										{#if pkg.note}
											<span class="lc-text-dim ml-2 text-xs">{pkg.note}</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- 프론트엔드 -->
			<div>
				<h3
					class="lc-text-primary mb-3 flex items-center gap-2 border-b border-[var(--lc-border-soft)] pb-2 text-sm font-bold"
				>
					<FontAwesomeIcon icon={faDesktop} class="lc-text-muted h-3.5 w-3.5" />
					프론트엔드 (SvelteKit)
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full min-w-120 border-collapse text-sm">
						<thead>
							<tr class="lc-text-muted border-b border-[var(--lc-border-soft)] text-xs">
								<th class="py-2 pr-4 text-left font-semibold">패키지</th>
								<th class="py-2 pr-4 text-left font-semibold">버전</th>
								<th class="py-2 text-left font-semibold">라이선스</th>
							</tr>
						</thead>
						<tbody>
							{#each frontendPackages as pkg (pkg.name)}
								<tr class="lc-table-row border-b">
									<td class="lc-text-secondary py-2 pr-4 font-mono text-xs">
										{pkg.name}
									</td>
									<td class="lc-text-dim py-2 pr-4 font-mono text-xs">{pkg.version}</td>
									<td class="py-2">
										<span
											class={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyle(pkg.license)}`}
										>
											{pkg.license}
										</span>
										{#if pkg.note}
											<span class="lc-text-dim ml-2 text-xs">{pkg.note}</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<!-- 라이선스 범례 -->
		<section class="lc-panel-card rounded-2xl border p-5">
			<h2 class="lc-text-primary mb-3 text-base font-bold">라이선스 유형 안내</h2>
			<div class="flex flex-wrap gap-3 text-xs">
				<div class="flex items-center gap-2">
					<span class="lc-chip-success rounded-full border px-2 py-0.5 font-medium">MIT</span>
					<span class="lc-text-muted">MIT License — 자유로운 사용·수정·배포 허용</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="lc-chip-info rounded-full border px-2 py-0.5 font-medium">Apache-2.0</span>
					<span class="lc-text-muted">Apache License 2.0 — 특허권 명시적 허여 포함</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="lc-chip-purple rounded-full border px-2 py-0.5 font-medium"
						>BSD-3-Clause</span
					>
					<span class="lc-text-muted">BSD 3-Clause License — 광고 조항 없는 BSD</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="lc-chip-warning rounded-full border px-2 py-0.5 font-medium">OFL-1.1</span>
					<span class="lc-text-muted">SIL Open Font License 1.1 — 폰트 전용 오픈 라이선스</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="lc-chip-warning rounded-full border px-2 py-0.5 font-medium"
						>CC-BY-4.0 AND MIT</span
					>
					<span class="lc-text-muted">Creative Commons BY 4.0 + MIT — 아이콘/코드 복합</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="lc-chip-teal rounded-full border px-2 py-0.5 font-medium"
						>MIT OR GPL-3.0-or-later</span
					>
					<span class="lc-text-muted">MIT 또는 GPL-3.0 선택 — 배포자가 라이선스 선택 가능</span>
				</div>
			</div>
		</section>
	</main>
</div>
