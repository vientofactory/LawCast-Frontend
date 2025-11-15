<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ChevronRight, HelpCircle } from 'lucide-svelte';

	let isExpanded = false;
</script>

<div class="mt-6 border-t border-gray-200 pt-6">
	<button
		type="button"
		on:click={() => (isExpanded = !isExpanded)}
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
		<div class="transition-transform duration-300 ease-out {isExpanded ? 'rotate-90' : 'rotate-0'}">
			<ChevronRight
				class="h-4 w-4 text-gray-500 transition-colors duration-200 group-hover:text-gray-600"
			/>
		</div>
	</button>

	{#if isExpanded}
		<div
			class="mt-4 overflow-hidden rounded-lg border border-blue-100 bg-blue-50/30 p-4"
			transition:slide={{ duration: 400, easing: cubicOut }}
			style="transform-origin: top;"
		>
			<h4 class="mb-3 text-sm font-semibold text-blue-800">Discord 웹훅 생성 단계별 가이드</h4>
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
