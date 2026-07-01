<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronRight, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
	let isExpanded = false;
</script>

<div class="mt-6 border-t border-[var(--lc-border-soft)] pt-6">
	<button
		type="button"
		on:click={() => (isExpanded = !isExpanded)}
		class="lc-panel-inset group flex w-full cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-300 hover:bg-[var(--lc-surface-hover)] hover:shadow-sm focus:ring-2 focus:ring-[var(--lc-border-strong)] focus:ring-offset-2 focus:outline-none"
	>
		<div class="flex items-center">
			<div class="lc-chip-blue mr-2 rounded-md p-1 transition-colors duration-200">
				<FontAwesomeIcon icon={faCircleInfo} class="h-4 w-4 transition-colors duration-200" />
			</div>
			<span
				class="lc-text-secondary text-sm font-medium transition-colors duration-200 group-hover:text-[var(--lc-text-primary)]"
			>
				Discord 웹훅 생성 방법 안내
			</span>
		</div>
		<div class="transition-transform duration-300 ease-out {isExpanded ? 'rotate-90' : 'rotate-0'}">
			<FontAwesomeIcon
				icon={faChevronRight}
				class="lc-text-muted h-4 w-4 transition-colors duration-200 group-hover:text-[var(--lc-text-secondary)]"
			/>
		</div>
	</button>

	{#if isExpanded}
		<div
			class="lc-banner-info mt-4 overflow-hidden rounded-lg border p-4"
			transition:slide={{ duration: 400, easing: cubicOut }}
			style="transform-origin: top;"
		>
			<h4 class="mb-3 text-sm font-semibold">Discord 웹훅 생성 단계별 가이드</h4>
			<ol class="lc-text-secondary space-y-2 text-sm">
				<li class="flex items-start">
					<span
						class="lc-step-chip mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
						class="lc-step-chip mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
						class="lc-step-chip mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
						class="lc-step-chip mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
						class="lc-step-chip mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
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
						class="lc-step-chip-success mt-0.5 mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
					>
						✓
					</span>
					<div>
						<strong>완료:</strong>
						복사한 URL을 위의 입력 필드에 붙여넣고 등록하세요!
					</div>
				</li>
			</ol>

			<div class="lc-banner-warning mt-4 rounded-md border p-3">
				<div class="flex items-start">
					<div class="mt-0.5 mr-2">
						<div class="lc-dot-warning h-1.5 w-1.5 rounded-full"></div>
					</div>
					<div class="text-xs">
						<strong>참고:</strong>
						웹훅 URL은
						<code class="lc-inline-code rounded px-1 py-0.5">
							https://discord.com/api/webhooks/
						</code>
						또는
						<code class="lc-inline-code rounded px-1 py-0.5">
							https://discordapp.com/api/webhooks/
						</code>
						로 시작해야 합니다.
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
