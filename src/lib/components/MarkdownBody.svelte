<script lang="ts">
	import type { Token, Tokens } from 'marked';
	// Self-import for recursion (Svelte 5 replacement for <svelte:self>).
	import MarkdownBody from './MarkdownBody.svelte';

	let { tokens }: { tokens: Token[] } = $props();

	// marked's token tree is intentionally dynamic (Generic carries an index
	// signature); casting once here keeps the template branches simple while
	// every rendered value is still escaped by Svelte (no raw HTML anywhere).
	const blocks = $derived(tokens as unknown as Tokens.Generic[]);

	/**
	 * Same-site paths and absolute web URLs are allowed as link targets;
	 * anything else (javascript:, data:, protocol-relative) falls back to
	 * plain text so untrusted Markdown can never emit an active URL.
	 */
	function safeHref(href: unknown): string | null {
		if (typeof href !== 'string') return null;
		const value = href.trim();
		if (/^(https?:|mailto:)/i.test(value)) return value;
		if (/^(\/(?!\/)|#|\.\.?\/)/.test(value)) return value;
		return null;
	}

	/** Image sources allow http(s) and same-site paths only. */
	function safeSrc(src: unknown): string | null {
		if (typeof src !== 'string') return null;
		const value = src.trim();
		if (/^https?:\/\//i.test(value)) return value;
		if (/^\/(?!\/)/.test(value)) return value;
		return null;
	}

	/** Body headings start at h2 — the notice title owns the page's h1. */
	function headingTag(depth: unknown): string {
		const level = typeof depth === 'number' && depth > 0 ? depth : 1;
		return `h${Math.min(Math.max(level + 1, 2), 6)}`;
	}

	/** Renders a validated text-align declaration for table cells. */
	function alignStyle(align: unknown): string | undefined {
		if (align === 'center' || align === 'left' || align === 'right') {
			return `text-align: ${align}`;
		}
		return undefined;
	}
</script>

<!--
	No root wrapper on purpose: this component recurses inside paragraphs,
	links and other inline contexts, where a wrapping <div> would produce
	invalid HTML nesting. Host pages provide the `.lc-md` container element.
-->
{#each blocks as token, index (index)}
	{#if token.type === 'space'}
		<!-- Whitespace between blocks carries no meaning once rendered. -->
	{:else if token.type === 'def'}
		<!-- Reference definitions are resolved by the parser, not rendered. -->
	{:else if token.type === 'heading'}
		<svelte:element this={headingTag(token.depth)} class="lc-md-heading">
			{#if token.tokens?.length}
				<MarkdownBody tokens={token.tokens} />
			{:else}
				{token.text ?? ''}
			{/if}
		</svelte:element>
	{:else if token.type === 'paragraph'}
		<p>
			{#if token.tokens?.length}
				<MarkdownBody tokens={token.tokens} />
			{:else}
				{token.text ?? ''}
			{/if}
		</p>
	{:else if token.type === 'text'}
		{#if token.tokens?.length}
			<MarkdownBody tokens={token.tokens} />
		{:else}
			{token.text ?? ''}
		{/if}
	{:else if token.type === 'strong'}
		<strong>
			{#if token.tokens?.length}
				<MarkdownBody tokens={token.tokens} />
			{:else}
				{token.text ?? ''}
			{/if}
		</strong>
	{:else if token.type === 'em'}
		<em>
			{#if token.tokens?.length}
				<MarkdownBody tokens={token.tokens} />
			{:else}
				{token.text ?? ''}
			{/if}
		</em>
	{:else if token.type === 'del'}
		<del>
			{#if token.tokens?.length}
				<MarkdownBody tokens={token.tokens} />
			{:else}
				{token.text ?? ''}
			{/if}
		</del>
	{:else if token.type === 'codespan'}
		<code>{token.text ?? ''}</code>
	{:else if token.type === 'code'}
		<pre><code class={token.lang ? `language-${token.lang}` : undefined}>{token.text ?? ''}</code
			></pre>
	{:else if token.type === 'link'}
		{#if safeHref(token.href)}
			<a href={safeHref(token.href)}>
				{#if token.tokens?.length}
					<MarkdownBody tokens={token.tokens} />
				{:else}
					{token.text ?? ''}
				{/if}
			</a>
		{:else if token.tokens?.length}
			<MarkdownBody tokens={token.tokens} />
		{:else}
			{token.text ?? ''}
		{/if}
	{:else if token.type === 'image'}
		{#if safeSrc(token.href)}
			<img src={safeSrc(token.href)} alt={token.text ?? ''} loading="lazy" />
		{:else}
			{token.text ?? ''}
		{/if}
	{:else if token.type === 'list'}
		<svelte:element
			this={token.ordered ? 'ol' : 'ul'}
			start={token.ordered && typeof token.start === 'number' ? token.start : undefined}
		>
			{#each token.items ?? [] as item, itemIndex (itemIndex)}
				<li>
					{#if item.task}
						<input type="checkbox" checked={item.checked} disabled aria-label="할 일" />
					{/if}
					{#if item.tokens?.length}
						<MarkdownBody tokens={item.tokens} />
					{:else}
						{item.text ?? ''}
					{/if}
				</li>
			{/each}
		</svelte:element>
	{:else if token.type === 'table'}
		<div class="lc-md-table-wrap">
			<table>
				<thead>
					<tr>
						{#each token.header ?? [] as cell, cellIndex (cellIndex)}
							<th style={alignStyle(cell.align ?? token.align?.[cellIndex])}>
								{#if cell.tokens?.length}
									<MarkdownBody tokens={cell.tokens} />
								{:else}
									{cell.text ?? ''}
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each token.rows ?? [] as row, rowIndex (rowIndex)}
						<tr>
							{#each row as cell, cellIndex (cellIndex)}
								<td style={alignStyle(cell.align ?? token.align?.[cellIndex])}>
									{#if cell.tokens?.length}
										<MarkdownBody tokens={cell.tokens} />
									{:else}
										{cell.text ?? ''}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if token.type === 'blockquote'}
		<blockquote>
			{#if token.tokens?.length}
				<MarkdownBody tokens={token.tokens} />
			{:else}
				{token.text ?? ''}
			{/if}
		</blockquote>
	{:else if token.type === 'hr'}
		<hr />
	{:else if token.type === 'br'}
		<br />
	{:else if token.type === 'notion-toggle'}
		<!-- Notion toggle block (lexed server-side) — a native, clickable disclosure. -->
		<details class="lc-md-toggle" data-testid="notice-toggle">
			<summary class="lc-md-toggle-summary">
				{#if token.summaryTokens?.length}
					<MarkdownBody tokens={token.summaryTokens} />
				{:else}
					{token.summary ?? ''}
				{/if}
			</summary>
			{#if token.tokens?.length}
				<div class="lc-md-toggle-body">
					<MarkdownBody tokens={token.tokens} />
				</div>
			{/if}
		</details>
	{:else if token.type === 'html'}
		<!-- Raw HTML from a notice body is shown as literal text, never executed. -->
		{token.text ?? token.raw ?? ''}
	{:else if token.type === 'escape'}
		{token.text ?? ''}
	{:else if token.tokens?.length}
		<!-- Unknown block types with children still render their content. -->
		<MarkdownBody tokens={token.tokens} />
	{:else}
		{token.text ?? token.raw ?? ''}
	{/if}
{/each}

<style>
	/*
	Container-level styles target the host element that wraps this component
	(`.lc-md` on the detail page) and are intentionally global. Everything
	below is scoped: bare selectors only match elements this component
	renders, so they never leak into the surrounding page.
	*/
	:global(.lc-md) {
		color: var(--lc-text-secondary);
		font-size: 0.875rem;
		line-height: 1.75;
		/* Notion soft line breaks inside a paragraph stay visible. */
		white-space: pre-line;
		word-break: break-word;
	}

	.lc-md-heading {
		color: var(--lc-text-primary);
		font-weight: 700;
		line-height: 1.4;
		margin: 1.25em 0 0.5em;
	}

	.lc-md-heading:first-child {
		margin-top: 0;
	}

	h2.lc-md-heading {
		font-size: 1.125rem;
	}

	h3.lc-md-heading {
		font-size: 1rem;
	}

	:is(h4, h5, h6).lc-md-heading {
		font-size: 0.9375rem;
	}

	p {
		margin: 0.5em 0;
	}

	:is(ul, ol) {
		margin: 0.5em 0;
		padding-left: 1.5em;
	}

	/* Tailwind preflight strips list markers — restore them for markdown. */
	ul {
		list-style: disc;
	}

	ol {
		list-style: decimal;
	}

	li {
		margin: 0.15em 0;
	}

	/* Nested list content arrives via recursion — exempt it from the scope check. */
	li :global(:is(p, ul, ol)) {
		margin: 0;
	}

	a {
		color: var(--lc-text-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	blockquote {
		border-left: 3px solid var(--lc-border-soft);
		color: var(--lc-text-muted);
		margin: 0.75em 0;
		padding-left: 0.75em;
	}

	pre {
		background: var(--lc-surface-inset);
		border: 1px solid var(--lc-border-soft);
		border-radius: 0.375rem;
		margin: 0.75em 0;
		overflow-x: auto;
		padding: 0.75em 1em;
		white-space: pre;
	}

	code {
		background: var(--lc-surface-inset);
		border-radius: 0.25rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.8125em;
		padding: 0.1em 0.35em;
	}

	pre code {
		background: none;
		font-size: 0.8125rem;
		padding: 0;
	}

	.lc-md-table-wrap {
		margin: 0.75em 0;
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		font-size: 0.8125rem;
		width: 100%;
	}

	:is(th, td) {
		border: 1px solid var(--lc-border-soft);
		padding: 0.4em 0.75em;
		text-align: left;
	}

	th {
		background: var(--lc-surface-primary);
		color: var(--lc-text-primary);
		font-weight: 600;
	}

	img {
		border-radius: 0.5rem;
		height: auto;
		margin: 0.5em 0;
		max-width: 100%;
	}

	hr {
		border: 0;
		border-top: 1px solid var(--lc-border-soft);
		margin: 1em 0;
	}

	.lc-md-toggle {
		border-left: 3px solid var(--lc-border-soft);
		margin: 0.75em 0;
		padding-left: 0.75em;
	}

	.lc-md-toggle-summary {
		color: var(--lc-text-primary);
		cursor: pointer;
		font-weight: 600;
		list-style: none;
		position: relative;
	}

	/* Collapse the default marker so the caret below can replace it everywhere. */
	.lc-md-toggle-summary::-webkit-details-marker {
		display: none;
	}

	/* Rotating caret: closed points right, open points down. */
	.lc-md-toggle-summary::before {
		content: '';
		border-left: 5px solid currentColor;
		border-top: 4px solid transparent;
		border-bottom: 4px solid transparent;
		display: inline-block;
		margin-right: 0.5em;
		transition: transform 0.15s ease;
		vertical-align: middle;
	}

	.lc-md-toggle[open] > .lc-md-toggle-summary::before {
		transform: rotate(90deg);
	}

	.lc-md-toggle-summary:hover {
		color: var(--lc-text-accent);
	}

	.lc-md-toggle-summary:focus-visible {
		border-radius: 0.25rem;
		outline: 2px solid var(--lc-text-accent);
		outline-offset: 2px;
	}

	.lc-md-toggle-body {
		margin-top: 0.5em;
	}

	input[type='checkbox'] {
		accent-color: var(--lc-text-accent);
		margin-right: 0.4em;
	}
</style>
