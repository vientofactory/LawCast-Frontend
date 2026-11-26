<script lang="ts">
	import { page } from '$app/state';
	import Header from '#lib/components/Header.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import type { LegalNoticeInline, LegalNoticePageData } from '#lib/types/legal-notice.ts';
	import { formatDateOnlyKST } from '#lib/utils/helpers.ts';

	let { data }: { data: LegalNoticePageData } = $props();
	const notice = $derived(data.notice);
	const pageUrl = $derived(page.url.origin + data.canonicalPath);
	const inlineLinkIds: Record<string, string> = {
		'/crawling-transparency': 'legal-transparency',
		'https://pal.assembly.go.kr/': 'legal-pal',
		'https://likms.assembly.go.kr/bill/main.do': 'legal-likms',
		'https://opinion.lawmaking.go.kr/': 'legal-nsm'
	};
</script>

<SeoHead
	title={data.isCurrent ? notice.title : `${notice.title} (${notice.id})`}
	description="LawCast의 공공 입법정보 이용 목적, 자료별 권리, 검색·수집에 관한 법적 고려사항과 정정·권리침해 문의 안내입니다."
	url={pageUrl}
	keywords="LawCast 법적 고지, 입법정보, 저작권, 공정이용, 크롤링, 출처"
/>

{#snippet inline(parts: LegalNoticeInline[])}
	{#each parts as part, index (index)}
		{#if part.source !== undefined}
			<a
				id={`legal-ref-${part.source}`}
				href={`#legal-source-${part.source}`}
				role="doc-noteref"
				aria-label={`근거 ${part.source} 보기`}
				data-testid={`legal-ref-${part.source}`}
				class="lc-link inline-flex min-h-11 min-w-11 scroll-mt-48 items-center justify-center align-middle text-sm"
				>[{part.source}]</a
			>
		{:else if part.href}
			<a
				href={part.href}
				class="lc-link inline-flex min-h-11 items-center"
				data-testid={inlineLinkIds[part.href]}>{part.text}</a
			>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

<div class="lc-page-shell">
	<Header />
	<main id="main-content" class="lc-main lc-main--document" data-testid="legal-notice">
		<div class="lc-page-heading">
			<h1 class="lc-page-title">{notice.title}</h1>
			<p class="lc-text-secondary mt-3 leading-relaxed">{notice.intro}</p>
			<p class="lc-text-muted mt-2 text-sm" data-testid="legal-version">
				판본 {notice.id} · 기록일: {formatDateOnlyKST(notice.recordedOn)} · 검토 기준일:
				{formatDateOnlyKST(notice.reviewedOn)}
			</p>
			<a
				href={`/legal/versions/${notice.id}`}
				class="lc-link inline-flex min-h-11 items-center text-sm"
				data-testid="legal-permalink">이 판본의 고정 주소</a
			>
			<a
				href="#legal-history-title"
				class="lc-link ml-4 inline-flex min-h-11 items-center text-sm"
				data-testid="legal-history-link">변경 이력 보기</a
			>
		</div>

		{#if !data.isCurrent}
			<aside
				class="lc-banner-warning mb-6"
				data-testid="legal-archive-banner"
				aria-label="이전 판본 안내"
			>
				<p>이전 판본을 보고 있습니다. 현재 안내 내용은 최신 고지에서 확인해 주세요.</p>
				<a
					href="/legal"
					class="lc-link inline-flex min-h-11 items-center"
					data-testid="legal-current">최신 고지 보기</a
				>
			</aside>
		{/if}

		<div class="lc-text-secondary space-y-8 leading-relaxed" data-testid="legal-body">
			{#each notice.sections as section (section.id)}
				<section
					aria-labelledby={section.id}
					role={section.id === 'legal-references' ? 'doc-endnotes' : undefined}
					data-testid={section.id === 'legal-references' ? 'legal-sources' : undefined}
				>
					<h2 id={section.id} class="lc-section-heading lc-text-primary mb-3">{section.title}</h2>
					{#each section.paragraphs as paragraph, index (index)}
						<p class="mt-3">{@render inline(paragraph)}</p>
					{/each}
					{#if section.emailTemplate}
						<div class="lc-panel-subtle mt-4 p-4" data-testid="legal-email-inquiry">
							<h3 class="lc-subsection-heading lc-text-primary">이메일 본문 양식 예시</h3>
							<p class="mt-3">
								받는 사람:
								<a
									href={`mailto:${section.emailTemplate.to}?subject=${encodeURIComponent(section.emailTemplate.subject)}&body=${encodeURIComponent(section.emailTemplate.body)}`}
									class="lc-link inline-flex min-h-11 items-center"
									data-testid="legal-contact">{section.emailTemplate.to}</a
								>
							</p>
							<p class="mt-1 text-sm">제목: {section.emailTemplate.subject}</p>
							<pre
								class="mt-3 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap"
								data-testid="legal-email-template">{section.emailTemplate.body}</pre>
							<p class="mt-3 text-sm">
								이메일 주소를 누르면 받는 사람·제목·본문 양식이 채워진 이메일 작성 창이 열립니다.
							</p>
						</div>
					{/if}
					{#if section.id === 'legal-references'}
						<ol class="mt-4 space-y-5" aria-label="각주와 참고자료">
							{#each notice.sources as source, index (source.href)}
								<li id={`legal-source-${index + 1}`} class="scroll-mt-48">
									<a
										href={source.href}
										class="lc-link"
										data-testid={`legal-source-link-${index + 1}`}>[{index + 1}] {source.title}</a
									>
									<p class="mt-1 text-sm">{source.note}</p>
									<a
										href={`#legal-ref-${index + 1}`}
										role="doc-backlink"
										aria-label={`각주 ${index + 1} 본문으로 돌아가기`}
										data-testid={`legal-backlink-${index + 1}`}
										class="lc-link inline-flex min-h-11 items-center text-sm">본문으로 돌아가기</a
									>
								</li>
							{/each}
						</ol>
					{/if}
				</section>
			{/each}
		</div>

		<section class="lc-section" aria-labelledby="legal-history-title" data-testid="legal-history">
			<h2 id="legal-history-title" class="lc-section-heading lc-text-primary scroll-mt-48">
				고지 변경 이력
			</h2>
			<p class="lc-text-secondary mt-3 text-sm leading-relaxed">
				기록일은 이 저장소에 판본을 보관한 날짜이며, 서비스 배포일이나 법적 효력 발생일을 뜻하지
				않습니다.
			</p>
			<nav aria-label="법적 고지 판본" class="mt-3" data-testid="legal-version-navigation">
				<ul class="lc-flat-list">
					{#each data.versions as version (version.id)}
						<li class="lc-flat-list-row">
							<a
								href={`/legal/versions/${version.id}`}
								aria-current={version.id === notice.id ? 'page' : undefined}
								class="lc-link inline-flex min-h-11 items-center"
								data-testid={`legal-history-${version.id}`}>{version.id} 판본</a
							>
							<p class="lc-text-secondary text-sm">
								{formatDateOnlyKST(version.recordedOn)} · {version.changeSummary}
							</p>
						</li>
					{/each}
				</ul>
			</nav>
		</section>
	</main>
</div>
