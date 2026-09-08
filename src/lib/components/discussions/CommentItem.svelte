<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faPenToSquare,
		faTrash,
		faQuoteLeft,
		faQuoteRight,
		faArrowRight,
		faUser,
		faRobot,
		faClock,
		faBan
	} from '@fortawesome/free-solid-svg-icons';
	import { DiscussionMessageType, type DiscussionComment } from '$lib/types/api';
	import { formatDateTimeKST } from '$lib/utils/helpers';
	import { onMount } from 'svelte';

	export let comment: DiscussionComment;
	export let isThreadClosed = false;
	export let allComments: DiscussionComment[] = [];
	export let onQuote: ((detail: { sequence: number; nickname: string }) => void) | undefined =
		undefined;
	export let onEdit: ((comment: DiscussionComment) => void) | undefined = undefined;
	export let onDelete: ((comment: DiscussionComment) => void) | undefined = undefined;

	function handleQuote() {
		onQuote?.({
			sequence: comment.sequence,
			nickname: comment.authorNickname
		});
	}

	function handleEdit() {
		onEdit?.(comment);
	}

	function handleDelete() {
		onDelete?.(comment);
	}

	function scrollToComment(sequence: number, event?: MouseEvent) {
		if (event) {
			event.preventDefault();
		}
		const targetEl = document.getElementById(`res-${sequence}`);
		if (targetEl) {
			targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			playHighlight(targetEl);
		}
	}

	function playHighlight(targetEl: HTMLElement): void {
		targetEl.classList.remove('lc-comment-highlight');
		void targetEl.offsetWidth;
		targetEl.classList.add('lc-comment-highlight');
		setTimeout(() => targetEl.classList.remove('lc-comment-highlight'), 1800);
	}

	onMount(() => {
		if (window.location.hash === `#res-${comment.sequence}`) {
			const targetEl = document.getElementById(`res-${comment.sequence}`);
			if (targetEl) playHighlight(targetEl);
		}
	});

	type ContentToken =
		{ type: 'text'; text: string } | { type: 'mention'; sequence: number; raw: string };

	type ContentBlock =
		| { type: 'quote-ref'; sequence: number }
		| { type: 'blockquote'; text: string }
		| { type: 'paragraph'; tokens: ContentToken[] };

	function parseInlineTokens(text: string): ContentToken[] {
		const tokens: ContentToken[] = [];
		const regex = /(>>\s*#?\d+)/g;
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = regex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				tokens.push({
					type: 'text',
					text: text.substring(lastIndex, match.index)
				});
			}
			const raw = match[0];
			const numMatch = raw.match(/\d+/);
			const seq = numMatch ? parseInt(numMatch[0], 10) : 0;
			tokens.push({
				type: 'mention',
				sequence: seq,
				raw
			});
			lastIndex = match.index + raw.length;
		}

		if (lastIndex < text.length) {
			tokens.push({
				type: 'text',
				text: text.substring(lastIndex)
			});
		}

		return tokens;
	}

	function parseCommentContent(content: string): ContentBlock[] {
		const lines = content.split('\n');
		const blocks: ContentBlock[] = [];
		let currentParagraphLines: string[] = [];

		function flushParagraph() {
			if (currentParagraphLines.length === 0) return;
			const paragraphText = currentParagraphLines.join('\n');
			currentParagraphLines = [];
			if (!paragraphText.trim()) return;

			const tokens = parseInlineTokens(paragraphText);
			blocks.push({ type: 'paragraph', tokens });
		}

		for (const line of lines) {
			const trimmed = line.trim();
			// Standalone quote reference line: >>#1 or >>1 or >#1
			const standaloneMatch = trimmed.match(/^(?:>>|>)\s*#?(\d+)$/);
			if (standaloneMatch) {
				flushParagraph();
				const seq = parseInt(standaloneMatch[1], 10);
				blocks.push({ type: 'quote-ref', sequence: seq });
				continue;
			}

			// Blockquote lines: > quote text
			if (line.startsWith('>') && !line.startsWith('>>') && !trimmed.match(/^>\s*#?\d+$/)) {
				flushParagraph();
				const quoteText = line.replace(/^>\s?/, '');
				blocks.push({ type: 'blockquote', text: quoteText });
				continue;
			}

			currentParagraphLines.push(line);
		}

		flushParagraph();
		return blocks;
	}

	function getQuotedComment(seq: number): DiscussionComment | undefined {
		return allComments.find((c) => c.sequence === seq);
	}

	$: contentBlocks = parseCommentContent(comment.content);
</script>

<div
	id={`res-${comment.sequence}`}
	data-testid={`discussion-comment-${comment.sequence}`}
	class={`group relative scroll-mt-24 rounded-xl border transition-colors ${
		comment.isDeleted
			? 'border-[var(--lc-border-soft)] bg-[var(--lc-surface-muted)]/50 opacity-70'
			: comment.messageType === DiscussionMessageType.SYSTEM
				? 'border-amber-400/70 bg-[var(--lc-surface-primary)] hover:border-amber-400'
				: 'border-[var(--lc-border-soft)] bg-[var(--lc-surface-primary)] hover:border-blue-500/40'
	} p-4`}
>
	<!-- Comment Topbar -->
	<div
		class="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--lc-border-soft)] pb-2.5"
	>
		<div class="flex flex-wrap items-center gap-2 text-xs">
			<button
				type="button"
				on:click={(e) => scrollToComment(comment.sequence, e)}
				class="lc-chip-blue inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold hover:opacity-80 cursor-pointer"
				title="댓글 번호"
			>
				#{comment.sequence}
			</button>
			<span class="lc-text-primary inline-flex items-center gap-1 font-semibold">
				<FontAwesomeIcon
					icon={comment.messageType === DiscussionMessageType.SYSTEM ? faRobot : faUser}
					class="lc-text-muted h-3 w-3"
				/>
				{comment.authorNickname}
			</span>
			{#if comment.messageType !== DiscussionMessageType.SYSTEM}
				<span
					class="lc-chip-muted rounded-md px-1.5 py-0.5 font-mono text-[11px] text-[var(--lc-text-muted)]"
				>
					{comment.authorIpMasked}
				</span>
			{/if}
			<span class="lc-text-muted inline-flex items-center gap-1 text-[11px]">
				<FontAwesomeIcon icon={faClock} class="h-2.5 w-2.5" />
				{formatDateTimeKST(comment.createdAt)}
			</span>
			{#if comment.isEdited && !comment.isDeleted}
				<span class="lc-text-dim text-[11px] italic"> (수정됨) </span>
			{/if}
		</div>

		<!-- Action Buttons -->
		{#if !comment.isDeleted && comment.messageType !== DiscussionMessageType.SYSTEM}
			<div
				class="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
			>
				{#if !isThreadClosed}
					<button
						type="button"
						on:click={handleQuote}
						title={`#${comment.sequence} 인용하여 답글`}
						data-testid={`discussion-comment-quote-${comment.sequence}`}
						class="lc-text-muted hover:lc-text-primary inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--lc-surface-hover)]"
					>
						<FontAwesomeIcon icon={faQuoteRight} class="h-3 w-3" />
						<span class="hidden sm:inline">인용</span>
					</button>
				{/if}
				<button
					type="button"
					on:click={handleEdit}
					title="의견 수정"
					class="lc-text-muted hover:lc-text-primary inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--lc-surface-hover)]"
				>
					<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
					<span class="hidden sm:inline">수정</span>
				</button>
				<button
					type="button"
					on:click={handleDelete}
					title="의견 삭제"
					class="lc-text-muted hover:text-red-500 inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-red-500/10"
				>
					<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
					<span class="hidden sm:inline">삭제</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Comment Body -->
	{#if comment.isDeleted}
		<div class="flex items-center gap-2 py-2 text-xs italic text-[var(--lc-text-dim)]">
			<FontAwesomeIcon icon={faBan} class="h-3.5 w-3.5 text-gray-400" />
			<span>{comment.content}</span>
		</div>
	{:else}
		<div class="space-y-2">
			{#each contentBlocks as block, blockIndex (blockIndex)}
				{#if block.type === 'quote-ref'}
					{@const quoted = getQuotedComment(block.sequence)}
					<button
						type="button"
						on:click={(e) => scrollToComment(block.sequence, e)}
						class="my-1.5 flex w-full max-w-sm items-center justify-between gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-left text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400 cursor-pointer"
					>
						<span class="inline-flex items-center gap-1.5 font-semibold">
							<FontAwesomeIcon icon={faQuoteLeft} class="h-3 w-3 opacity-80" />
							<span
								>#{block.sequence}번 의견{#if quoted}
									({quoted.isDeleted ? '삭제됨' : quoted.authorNickname}){/if} 인용</span
							>
						</span>
						<span class="inline-flex items-center gap-1 text-[11px] font-normal opacity-80">
							<span>이동</span>
							<FontAwesomeIcon icon={faArrowRight} class="h-2.5 w-2.5" />
						</span>
					</button>
				{:else if block.type === 'blockquote'}
					<blockquote
						class="my-1.5 rounded-r-lg border-l-2 border-blue-500/60 bg-[var(--lc-surface-muted)] px-3 py-1.5 text-xs text-[var(--lc-text-secondary)] italic"
					>
						{block.text}
					</blockquote>
				{:else if block.type === 'paragraph'}
					<div class="lc-text-primary whitespace-pre-wrap break-words text-sm leading-relaxed">
						{#each block.tokens as token, tokenIndex (tokenIndex)}
							{#if token.type === 'text'}
								{token.text}
							{:else if token.type === 'mention'}
								<button
									type="button"
									on:click={(e) => scrollToComment(token.sequence, e)}
									class="lc-chip-blue mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-semibold hover:underline cursor-pointer align-baseline"
									title={`#${token.sequence}번 의견으로 이동`}
								>
									<FontAwesomeIcon icon={faQuoteRight} class="h-2.5 w-2.5 opacity-70" />
									#{token.sequence}
								</button>
							{/if}
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
