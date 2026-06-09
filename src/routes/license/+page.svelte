<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faScaleBalanced, faServer, faDesktop } from '@fortawesome/free-solid-svg-icons';
	import type { PageData } from './$types';

	export let data: PageData;

	$: ({ backendPackages, frontendPackages } = data);

	const licenseBadgeStyle: Record<string, string> = {
		MIT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
		'Apache-2.0': 'bg-sky-100 text-sky-700 border-sky-200',
		'BSD-3-Clause': 'bg-violet-100 text-violet-700 border-violet-200',
		'OFL-1.1': 'bg-amber-100 text-amber-700 border-amber-200',
		'CC-BY-4.0 AND MIT': 'bg-orange-100 text-orange-700 border-orange-200',
		'MIT OR GPL-3.0-or-later': 'bg-teal-100 text-teal-700 border-teal-200'
	};

	function badgeStyle(license: string): string {
		return licenseBadgeStyle[license] ?? 'bg-slate-100 text-slate-600 border-slate-200';
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

<div class="min-h-screen bg-linear-to-br from-slate-50 via-violet-50/20 to-indigo-50/20">
	<Header />

	<main id="main-content" class="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- 페이지 헤더 -->
		<div class="mb-6 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-sm">
			<p class="text-xs font-semibold tracking-wide text-violet-700">LICENSE</p>
			<h1 class="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
				<FontAwesomeIcon icon={faScaleBalanced} class="h-6 w-6 text-violet-600" />
				라이선스 고지
			</h1>
			<p class="mt-1 text-sm text-slate-500">
				LawCast 프로젝트의 라이선스 및 사용된 오픈소스 패키지의 라이선스 고지입니다.
			</p>
		</div>

		<!-- LawCast 프로젝트 라이선스 -->
		<section class="mb-6 rounded-2xl border border-violet-100 bg-white/90 p-5 shadow-sm">
			<h2 class="mb-3 text-base font-bold text-slate-900">LawCast 프로젝트 라이선스</h2>
			<p class="mb-3 text-sm text-slate-600">
				LawCast는 <span class="font-semibold text-violet-700">MIT License</span> 하에 배포됩니다.
			</p>
			<pre
				class="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-700">MIT License

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
		<section class="mb-6 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm">
			<h2 class="mb-1 text-base font-bold text-slate-900">오픈소스 라이선스 고지</h2>
			<p class="mb-5 text-sm text-slate-500">
				이 소프트웨어는 아래 오픈소스 패키지를 사용합니다. 각 패키지의 라이선스 조건을 준수합니다.
			</p>

			<!-- 백엔드 -->
			<div class="mb-6">
				<h3
					class="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800"
				>
					<FontAwesomeIcon icon={faServer} class="h-3.5 w-3.5 text-slate-500" />
					백엔드 (NestJS)
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full min-w-120 border-collapse text-sm">
						<thead>
							<tr class="border-b border-slate-100 text-xs text-slate-500">
								<th class="py-2 pr-4 text-left font-semibold">패키지</th>
								<th class="py-2 pr-4 text-left font-semibold">버전</th>
								<th class="py-2 text-left font-semibold">라이선스</th>
							</tr>
						</thead>
						<tbody>
							{#each backendPackages as pkg (pkg.name)}
								<tr class="border-b border-slate-50 hover:bg-slate-50/70">
									<td class="py-2 pr-4 font-mono text-xs text-slate-700">
										{pkg.name}
									</td>
									<td class="py-2 pr-4 font-mono text-xs text-slate-400">{pkg.version}</td>
									<td class="py-2">
										<span
											class={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyle(pkg.license)}`}
										>
											{pkg.license}
										</span>
										{#if pkg.note}
											<span class="ml-2 text-xs text-slate-400">{pkg.note}</span>
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
					class="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800"
				>
					<FontAwesomeIcon icon={faDesktop} class="h-3.5 w-3.5 text-slate-500" />
					프론트엔드 (SvelteKit)
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full min-w-120 border-collapse text-sm">
						<thead>
							<tr class="border-b border-slate-100 text-xs text-slate-500">
								<th class="py-2 pr-4 text-left font-semibold">패키지</th>
								<th class="py-2 pr-4 text-left font-semibold">버전</th>
								<th class="py-2 text-left font-semibold">라이선스</th>
							</tr>
						</thead>
						<tbody>
							{#each frontendPackages as pkg (pkg.name)}
								<tr class="border-b border-slate-50 hover:bg-slate-50/70">
									<td class="py-2 pr-4 font-mono text-xs text-slate-700">
										{pkg.name}
									</td>
									<td class="py-2 pr-4 font-mono text-xs text-slate-400">{pkg.version}</td>
									<td class="py-2">
										<span
											class={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyle(pkg.license)}`}
										>
											{pkg.license}
										</span>
										{#if pkg.note}
											<span class="ml-2 text-xs text-slate-400">{pkg.note}</span>
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
		<section class="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm">
			<h2 class="mb-3 text-base font-bold text-slate-900">라이선스 유형 안내</h2>
			<div class="flex flex-wrap gap-3 text-xs">
				<div class="flex items-center gap-2">
					<span
						class="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700"
						>MIT</span
					>
					<span class="text-slate-500">MIT License — 자유로운 사용·수정·배포 허용</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 font-medium text-sky-700"
						>Apache-2.0</span
					>
					<span class="text-slate-500">Apache License 2.0 — 특허권 명시적 허여 포함</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 font-medium text-violet-700"
						>BSD-3-Clause</span
					>
					<span class="text-slate-500">BSD 3-Clause License — 광고 조항 없는 BSD</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 font-medium text-amber-700"
						>OFL-1.1</span
					>
					<span class="text-slate-500">SIL Open Font License 1.1 — 폰트 전용 오픈 라이선스</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 font-medium text-orange-700"
						>CC-BY-4.0 AND MIT</span
					>
					<span class="text-slate-500">Creative Commons BY 4.0 + MIT — 아이콘/코드 복합</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="rounded-full border border-teal-200 bg-teal-100 px-2 py-0.5 font-medium text-teal-700"
						>MIT OR GPL-3.0-or-later</span
					>
					<span class="text-slate-500">MIT 또는 GPL-3.0 선택 — 배포자가 라이선스 선택 가능</span>
				</div>
			</div>
		</section>
	</main>
</div>
