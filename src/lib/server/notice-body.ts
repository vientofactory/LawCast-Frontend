import { marked, type Token, type Tokens } from 'marked';

/**
 * Synthetic token for one Notion toggle block: notion-to-md converts a Notion
 * toggle into `<details><summary>...</summary>...</details>` HTML, which the
 * generic lexer would otherwise split into raw-HTML tokens rendered as literal
 * text. It extends marked's Generic token so it serializes and renders like any
 * other token.
 */
export interface NoticeToggleToken extends Tokens.Generic {
	type: 'notion-toggle';
	raw: string;
	/** Raw summary line text (fallback when inline lexing yields nothing). */
	summary: string;
	/** Inline tokens for the summary — rendered inside <summary>. */
	summaryTokens: Token[];
	/** Child block tokens (nested toggles included) — rendered inside <details>. */
	tokens: Token[];
}

/** A `<details>` open line, at most 3 spaces indented (CommonMark HTML block). */
const TOGGLE_OPEN = /^ {0,3}<details>[ \t]*$/;
/** The matching `</details>` close line. */
const TOGGLE_CLOSE = /^ {0,3}<\/details>[ \t]*$/;
/** notion-to-md always writes the summary on the line right after <details>. */
const SUMMARY_LINE = /^ {0,3}<summary>([\s\S]*?)<\/summary>[ \t]*$/;
/** Opening/closing code fence marker (``` or ~~~). */
const FENCE_MARKER = /^ {0,3}(`{3,}|~{3,})/;

interface Fence {
	char: string;
	len: number;
}

/**
 * Advances fence state for one line: opens a fence on the first marker line,
 * closes it when a same-char marker of >= length is the only content.
 * Fence contents are opaque — `<details>` inside a code sample stays literal.
 */
function updateFence(fence: Fence | null, line: string): Fence | null {
	const match = FENCE_MARKER.exec(line);
	if (!match) {
		return fence;
	}
	const marker = match[1];
	if (!fence) {
		return { char: marker[0], len: marker.length };
	}
	const isClosing =
		marker[0] === fence.char &&
		marker.length >= fence.len &&
		line.slice(match[0].length).trim() === '';
	return isClosing ? null : fence;
}

/**
 * Lexes an inline markdown string into tokens usable inside `<summary>`
 * (phrasing content only — a block token like a heading would be invalid
 * there). Odd shapes (a title starting with `#`, `-`, ...) fall back to plain
 * text so no markdown syntax leaks into the summary.
 */
function lexSummary(text: string): Token[] {
	const trimmed = text.trim();
	if (!trimmed) {
		return [];
	}
	const blocks = marked.lexer(trimmed);
	if (blocks.length === 1 && blocks[0].type === 'paragraph') {
		return (blocks[0] as Tokens.Paragraph).tokens ?? [];
	}
	return [{ type: 'text', raw: trimmed, text: trimmed }];
}

/**
 * Tries to parse a complete toggle starting at `lines[start]`.
 * Returns the token plus the index of its closing `</details>` line, or null
 * when the shape is not a well-formed toggle (missing/odd summary, unbalanced
 * tags) — the caller then keeps the lines as literal markdown instead of
 * guessing.
 */
function parseToggle(
	lines: string[],
	start: number
): { token: NoticeToggleToken; end: number } | null {
	const summaryMatch = SUMMARY_LINE.exec(lines[start + 1] ?? '');
	if (!summaryMatch) {
		return null;
	}

	let depth = 1;
	let fence: Fence | null = null;
	let end = -1;
	for (let index = start + 2; index < lines.length; index++) {
		const line = lines[index];
		if (fence) {
			fence = updateFence(fence, line);
			continue;
		}
		fence = updateFence(null, line);
		if (fence) {
			// This line opened a code fence — its contents never count.
			continue;
		}
		if (TOGGLE_OPEN.test(line)) {
			depth++;
		} else if (TOGGLE_CLOSE.test(line)) {
			depth--;
			if (depth === 0) {
				end = index;
				break;
			}
		}
	}
	if (end === -1) {
		return null;
	}

	const summary = summaryMatch[1];
	const children = lines.slice(start + 2, end).join('\n');
	return {
		token: {
			type: 'notion-toggle',
			raw: lines.slice(start, end + 1).join('\n'),
			summary,
			summaryTokens: lexSummary(summary),
			// Recursion: nested toggles inside the children become tokens too.
			tokens: lexNoticeBody(children)
		},
		end
	};
}

/**
 * Lexes a Notion notice body (Markdown as produced by notion-to-md) into the
 * token tree the MarkdownBody component renders. On top of `marked.lexer` it
 * lifts balanced `<details>/<summary>` toggle blocks into `notion-toggle`
 * tokens, so the detail page renders them as native, keyboard-operable
 * disclosures instead of printing the HTML tags as text. Everything else —
 * including malformed or code-fenced `<details>` — keeps the existing
 * behavior: markdown tokens, and raw HTML shown as literal text.
 */
export function lexNoticeBody(markdown: string): Token[] {
	const tokens: Token[] = [];
	const lines = markdown.split('\n');
	let buffer: string[] = [];
	let fence: Fence | null = null;

	const flush = () => {
		if (buffer.length === 0) {
			return;
		}
		const source = buffer.join('\n');
		buffer = [];
		if (source.trim()) {
			tokens.push(...marked.lexer(source));
		}
	};

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (fence) {
			buffer.push(line);
			fence = updateFence(fence, line);
			continue;
		}

		if (TOGGLE_OPEN.test(line)) {
			const parsed = parseToggle(lines, index);
			if (parsed) {
				flush();
				tokens.push(parsed.token);
				index = parsed.end;
				continue;
			}
			// Malformed toggle: fall through and render it literally.
		}

		buffer.push(line);
		fence = updateFence(null, line);
	}
	flush();

	return tokens;
}
