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
		faBullhorn,
		faBan
	} from '@fortawesome/free-solid-svg-icons';
	import { DiscussionMessageType, type DiscussionComment } from '#lib/types/api.ts';
	import { formatDateTimeKST } from '#lib/utils/helpers.ts';
	import { onMount } from 'svelte';
	import { clearCommentHighlight, highlightComment } from '#lib/utils/comment-highlight.ts';

	let {
		comment,
		isThreadClosed = false,
		allComments = [],
		onQuote,
		onEdit,
		onDelete
	}: {
		comment: DiscussionComment;
		isThreadClosed?: boolean;
		allComments?: DiscussionComment[];
		onQuote?: (detail: { sequence: number; nickname: string }) => void;
		onEdit?: (comment: DiscussionComment) => void;
		onDelete?: (comment: DiscussionComment) => void;
	} = $props();

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
		if (targetEl) highlightComment(targetEl);
	}

	onMount(() => {
		const targetEl = document.getElementById(`res-${comment.sequence}`);
		if (!targetEl) return;
		if (window.location.hash === `#res-${comment.sequence}`) {
			highlightComment(targetEl, false);
		}
		return () => clearCommentHighlight(targetEl);
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

	let contentBlocks = $derived(parseCommentContent(comment.content));
	let isNonUserMessage = $derived(
		comment.messageType === DiscussionMessageType.SYSTEM ||
			comment.messageType === DiscussionMessageType.ADMIN
	);
</script>

<article
	id={`res-${comment.sequence}`}
	data-testid={`discussion-comment-${comment.sequence}`}
	aria-labelledby={`comment-author-${comment.sequence}`}
	class="lc-flat-list-row lc-comment-target relative scroll-mt-24"
>
	<header class="mb-3 space-y-1">
		<div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
			<button
				type="button"
				onclick={(e) => scrollToComment(comment.sequence, e)}
				class="lc-text-accent inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center font-mono text-sm font-semibold underline underline-offset-4"
				title="댓글 번호"
				data-testid={`discussion-comment-number-${comment.sequence}`}
			>
				#{comment.sequence}
			</button>
			<span
				id={`comment-author-${comment.sequence}`}
				class="lc-text-primary inline-flex min-w-0 items-baseline gap-1.5 font-semibold wrap-anywhere"
			>
				<FontAwesomeIcon
					icon={comment.messageType === DiscussionMessageType.SYSTEM
						? faRobot
						: comment.messageType === DiscussionMessageType.ADMIN
							? faBullhorn
							: faUser}
					class="lc-text-muted h-3 w-3 shrink-0"
				/>
				{comment.authorNickname}
			</span>
			{#if comment.messageType === DiscussionMessageType.ADMIN}
				<span class="lc-text-secondary text-sm font-medium">관리자</span>
			{:else if !isNonUserMessage}
				<span class="lc-text-muted font-mono text-sm wrap-anywhere">{comment.authorIpMasked}</span>
			{/if}
		</div>
		<div class="lc-text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
			<time datetime={comment.createdAt}>{formatDateTimeKST(comment.createdAt)}</time>
			{#if comment.isEdited && !comment.isDeleted}
				<span>(수정됨)</span>
			{/if}
		</div>
	</header>

	<!-- Comment Body -->
	{#if comment.isDeleted}
		<div class="lc-text-muted flex items-start gap-2 py-2 text-sm wrap-anywhere">
			<FontAwesomeIcon icon={faBan} class="mt-1 h-3.5 w-3.5 shrink-0" />
			<span>{comment.content}</span>
		</div>
	{:else}
		<div class="space-y-2">
			{#each contentBlocks as block, blockIndex (blockIndex)}
				{#if block.type === 'quote-ref'}
					{@const quoted = getQuotedComment(block.sequence)}
					<button
						type="button"
						onclick={(e) => scrollToComment(block.sequence, e)}
						class="lc-comment-reference lc-text-secondary my-2 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 border-l-2 border-[var(--lc-border-strong)] bg-[var(--lc-surface-muted)] px-3 py-2 text-left text-sm hover:text-[var(--lc-text-accent)]"
					>
						<span class="inline-flex min-w-0 items-baseline gap-1.5 font-semibold wrap-anywhere">
							<FontAwesomeIcon icon={faQuoteLeft} class="h-3 w-3 shrink-0" />
							<span
								>#{block.sequence}번 의견{#if quoted}
									({quoted.isDeleted ? '삭제됨' : quoted.authorNickname}){/if} 인용</span
							>
						</span>
						<span class="inline-flex shrink-0 items-center gap-1 text-sm font-normal">
							<span>이동</span>
							<FontAwesomeIcon icon={faArrowRight} class="h-2.5 w-2.5" />
						</span>
					</button>
				{:else if block.type === 'blockquote'}
					<blockquote
						class="my-2 border-l-2 border-[var(--lc-border-strong)] pl-3 text-sm leading-relaxed wrap-anywhere text-[var(--lc-text-secondary)]"
					>
						{block.text}
					</blockquote>
				{:else if block.type === 'paragraph'}
					<div class="lc-text-primary text-base leading-relaxed wrap-anywhere whitespace-pre-wrap">
						{#each block.tokens as token, tokenIndex (tokenIndex)}
							{#if token.type === 'text'}
								{token.text}
							{:else if token.type === 'mention'}
								<button
									type="button"
									onclick={(e) => scrollToComment(token.sequence, e)}
									class="lc-text-accent mx-0.5 inline-flex min-h-6 cursor-pointer items-center gap-1 align-baseline font-mono text-sm font-semibold underline underline-offset-4"
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

	<!-- Comment actions follow the reading content. -->
	{#if !comment.isDeleted && !isNonUserMessage && !isThreadClosed}
		<div
			class="mt-3 flex flex-wrap items-center gap-1"
			data-testid={`discussion-comment-actions-${comment.sequence}`}
		>
			<button
				type="button"
				onclick={handleQuote}
				title={`#${comment.sequence} 인용하여 답글`}
				data-testid={`discussion-comment-quote-${comment.sequence}`}
				class="lc-result-action-secondary"
			>
				<FontAwesomeIcon icon={faQuoteRight} class="h-3 w-3" />
				<span>인용</span>
			</button>
			<button
				type="button"
				onclick={handleEdit}
				title="의견 수정"
				data-testid={`discussion-comment-edit-${comment.sequence}`}
				class="lc-result-action-secondary"
			>
				<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
				<span>수정</span>
			</button>
			<button
				type="button"
				onclick={handleDelete}
				title="의견 삭제"
				data-testid={`discussion-comment-delete-${comment.sequence}`}
				class="lc-result-action-secondary"
			>
				<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
				<span>삭제</span>
			</button>
		</div>
	{/if}
</article>
