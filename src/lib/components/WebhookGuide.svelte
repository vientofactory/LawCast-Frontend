<script lang="ts">
	import DisclosureIndicator from '#lib/components/DisclosureIndicator.svelte';
	import { disclosureMotion } from '#lib/utils/disclosure-motion.ts';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';

	const steps = [
		{
			title: '알림을 받을 채널 선택',
			description: '디스코드 서버에서 알림을 받고 싶은 텍스트 채널로 이동합니다.'
		},
		{
			title: '채널 설정 열기',
			description:
				'채널 이름 옆의 톱니바퀴 아이콘을 클릭하거나, 채널을 우클릭하여 “채널 편집”을 선택합니다.'
		},
		{ title: '연동 탭 선택', description: '좌측 메뉴에서 “연동(Integrations)” 탭을 클릭합니다.' },
		{ title: '웹훅 생성', description: '“웹훅 보기” 또는 “웹훅 만들기” 버튼을 클릭합니다.' },
		{
			title: '웹훅 URL 복사',
			description: '생성된 웹훅의 “웹훅 URL 복사” 버튼을 클릭해 URL을 복사합니다.'
		},
		{
			title: 'LawCast에 등록',
			description: '복사한 URL을 위의 웹훅 URL 입력란에 붙여넣고 등록합니다.'
		}
	];
</script>

<details
	use:disclosureMotion
	class="lc-webhook-guide group mt-6 border-t border-[var(--lc-border-soft)] pt-6"
	data-testid="webhook-guide"
>
	<summary
		data-testid="webhook-guide-toggle"
		class="lc-disclosure-trigger lc-disclosure-trigger--compact"
	>
		<span class="flex min-w-0 items-center gap-2.5">
			<FontAwesomeIcon icon={faCircleInfo} class="lc-text-accent h-4 w-4 shrink-0" />
			<span class="lc-text-primary text-base font-semibold">디스코드 웹훅 생성 방법 안내</span>
		</span>
		<DisclosureIndicator />
	</summary>

	<div class="mt-5" data-testid="webhook-guide-content">
		<p class="lc-text-secondary text-sm leading-relaxed">
			디스코드에서 웹훅 URL을 만든 뒤 LawCast에 등록하면 해당 채널로 알림을 받을 수 있습니다.
		</p>
		<ol class="lc-webhook-steps mt-4" aria-label="웹훅 생성 및 등록 순서">
			{#each steps as step, index (step.title)}
				<li>
					<span class="lc-webhook-step-number" aria-hidden="true"
						>{String(index + 1).padStart(2, '0')}</span
					>
					<div class="min-w-0">
						<h3 class="lc-text-primary text-base font-semibold">{step.title}</h3>
						<p class="lc-text-secondary mt-1 text-sm leading-relaxed">{step.description}</p>
					</div>
				</li>
			{/each}
		</ol>
		<aside
			class="lc-webhook-url-note mt-5"
			aria-labelledby="webhook-url-note-title"
			data-testid="webhook-guide-url-note"
		>
			<h3 id="webhook-url-note-title" class="lc-text-primary text-sm font-semibold">
				웹훅 URL 형식
			</h3>
			<p class="lc-text-secondary mt-1 text-sm leading-relaxed">
				복사한 URL이 아래 주소 중 하나로 시작하는지 확인하세요.
			</p>
			<ul class="lc-text-secondary mt-3 space-y-2 text-sm">
				<li><code>https://discord.com/api/webhooks/</code></li>
				<li><code>https://discordapp.com/api/webhooks/</code></li>
			</ul>
		</aside>
	</div>
</details>

<style>
	.lc-webhook-steps > li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		gap: 0.75rem;
		padding-block: 1rem;
	}
	.lc-webhook-steps > li + li {
		border-top: 1px solid var(--lc-border-soft);
	}
	.lc-webhook-step-number {
		color: var(--lc-text-accent);
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1.5rem;
		font-variant-numeric: tabular-nums;
	}
	.lc-webhook-url-note {
		padding: 1rem;
		background: var(--lc-surface-muted);
		border-top: 1px solid var(--lc-border-soft);
	}
	.lc-webhook-url-note code {
		white-space: normal;
		overflow-wrap: anywhere;
	}
</style>
