<script lang="ts">
	import * as env from '$app/env/public';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowUpRightFromSquare,
		faRotateRight,
		faSignal,
		faServer
	} from '@fortawesome/free-solid-svg-icons';
	import { faDiscord } from '@fortawesome/free-brands-svg-icons';
	import { getFailureKind, type LoadErrorPayload } from '#lib/utils/request-failure.ts';

	let {
		error,
		onRetry,
		isRetrying = false,
		testId = 'load-failure',
		headingLevel = 2
	}: {
		error: LoadErrorPayload;
		onRetry?: () => void | Promise<void>;
		isRetrying?: boolean;
		testId?: string;
		headingLevel?: 1 | 2;
	} = $props();
	const discordUrl = env.PUBLIC_DISCORD_SERVER_URL?.trim() || 'https://discord.gg/er675xfv7K';
	const statusUrl = 'https://stats.uptimerobot.com/t2yRqkjHzp';
</script>

<section data-testid={testId} data-failure-kind={getFailureKind(error)} aria-busy={isRetrying}>
	<div class="lc-server-offline" data-testid="server-offline-screen" role="alert">
		<div class="lc-page-heading">
			<p class="lc-text-secondary mb-4 flex items-center gap-3 text-sm font-semibold">
				<span
					class="lc-empty-state-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
					aria-hidden="true"
				>
					<FontAwesomeIcon icon={faServer} class="lc-text-muted h-5 w-5" />
				</span>
				서버 연결 안내
			</p>
			<svelte:element
				this={headingLevel === 1 ? 'h1' : 'h2'}
				class:lc-page-title={headingLevel === 1}
				class="lc-text-primary text-xl leading-snug font-bold sm:text-2xl"
			>
				데이터 서버에 연결할 수 없습니다
			</svelte:element>
		</div>
		<p class="lc-text-secondary max-w-prose text-sm leading-relaxed sm:text-base">
			데이터 서버와 연결을 맺지 못했습니다. 서버 상태를 확인하거나 잠시 후 다시 시도해 주세요.
		</p>
		<div class="lc-server-offline-actions mt-6 flex flex-wrap gap-3">
			{#if onRetry}
				<button
					type="button"
					class="lc-button-primary inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold"
					onclick={onRetry}
					disabled={isRetrying}
					data-testid="server-offline-retry"
				>
					<FontAwesomeIcon
						icon={faRotateRight}
						class={isRetrying ? 'h-4 w-4 motion-safe:animate-spin' : 'h-4 w-4'}
					/>
					{isRetrying ? '다시 시도 중...' : '다시 시도'}
				</button>
			{/if}
			<a
				href={statusUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="lc-button-neutral inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold"
				data-testid="server-offline-status"
			>
				<FontAwesomeIcon icon={faSignal} class="h-4 w-4 shrink-0" />
				서비스 상태 확인
				<FontAwesomeIcon icon={faArrowUpRightFromSquare} class="h-3 w-3 shrink-0" />
				<span class="sr-only">(UptimeRobot, 새 탭)</span>
			</a>
		</div>
		<div class="mt-8 border-t border-[var(--lc-border-soft)] pt-5">
			<p class="lc-text-muted text-sm leading-relaxed">
				복구 소식은 공식 디스코드에서도 확인할 수 있습니다.
			</p>
			<a
				href={discordUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="lc-link mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold"
				data-testid="server-offline-discord"
			>
				<FontAwesomeIcon icon={faDiscord} class="h-4 w-4 shrink-0" />
				공식 디스코드 참여
				<FontAwesomeIcon icon={faArrowUpRightFromSquare} class="h-3 w-3 shrink-0" />
				<span class="sr-only">(새 탭)</span>
			</a>
		</div>
	</div>
</section>

<style>
	.lc-server-offline {
		width: 100%;
		padding-block: clamp(1.25rem, 4vw, 2.5rem);
		word-break: keep-all;
		overflow-wrap: anywhere;
	}
	@media (max-width: 479px) {
		.lc-server-offline-actions > :global(*) {
			flex: 1 1 12rem;
		}
	}
</style>
