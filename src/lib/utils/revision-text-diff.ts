export type DiffSegment = { text: string; kind: 'context' | 'removed' | 'added' };
export type RevisionTextBlock =
	| { kind: 'context'; text: string }
	| {
			kind: 'change';
			beforeText: string;
			afterText: string;
			diff: ReturnType<typeof buildInlineDiffSegments>;
	  };

// Cap edit-distance work and trace memory rather than allocating a quadratic matrix.
function shortestEdits(before: string[], after: string[]): DiffSegment[] | null {
	if (!before.length) return after.length ? [{ kind: 'added', text: after.join('') }] : [];
	if (!after.length) return [{ kind: 'removed', text: before.join('') }];
	const frontier = new Map<number, number>([[1, 0]]);
	const trace: Map<number, number>[] = [];
	let work = 0;
	for (let distance = 0; distance <= Math.min(before.length + after.length, 256); distance++) {
		trace.push(new Map(frontier));
		for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
			if (++work > 250_000) return null;
			let x =
				diagonal === -distance ||
				(diagonal !== distance &&
					(frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1))
					? (frontier.get(diagonal + 1) ?? 0)
					: (frontier.get(diagonal - 1) ?? 0) + 1;
			let y = x - diagonal;
			while (x < before.length && y < after.length && before[x] === after[y]) {
				x++;
				y++;
				if (++work > 250_000) return null;
			}
			frontier.set(diagonal, x);
			if (x < before.length || y < after.length) continue;
			const result: DiffSegment[] = [];
			for (let d = distance; d >= 0; d--) {
				const previous = trace[d];
				const k = x - y;
				const previousK =
					k === -d || (k !== d && (previous.get(k - 1) ?? -1) < (previous.get(k + 1) ?? -1))
						? k + 1
						: k - 1;
				const previousX = previous.get(previousK) ?? 0;
				const previousY = previousX - previousK;
				while (x > previousX && y > previousY) {
					result.push({ kind: 'context', text: before[--x] });
					y--;
				}
				if (d === 0) break;
				if (x === previousX) result.push({ kind: 'added', text: after[--y] });
				else result.push({ kind: 'removed', text: before[--x] });
			}
			return result.reverse();
		}
	}
	return null;
}

function sequenceDiff(before: string[], after: string[]) {
	let prefix = 0;
	while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix])
		prefix++;
	let suffix = 0;
	while (
		suffix < Math.min(before.length, after.length) - prefix &&
		before.at(-suffix - 1) === after.at(-suffix - 1)
	)
		suffix++;
	const left = before.slice(prefix, before.length - suffix);
	const right = after.slice(prefix, after.length - suffix);
	const edits = shortestEdits(left, right);
	const segments: DiffSegment[] = [];
	function append(segment: DiffSegment) {
		if (!segment.text) return;
		const last = segments.at(-1);
		if (last?.kind === segment.kind) last.text += segment.text;
		else segments.push({ ...segment });
	}
	append({ kind: 'context', text: before.slice(0, prefix).join('') });
	for (const segment of edits ?? [
		{ kind: 'removed' as const, text: left.join('') },
		{ kind: 'added' as const, text: right.join('') }
	])
		append(segment);
	if (suffix) append({ kind: 'context', text: before.slice(-suffix).join('') });
	return { segments, coarse: edits === null };
}

export function buildInlineDiffSegments(beforeValue: string, afterValue: string) {
	// Code-point boundaries keep supplementary characters intact during refinement.
	const characters = sequenceDiff(Array.from(beforeValue), Array.from(afterValue));
	const beforeSegments = characters.segments.filter((segment) => segment.kind !== 'added');
	const afterSegments = characters.segments.filter((segment) => segment.kind !== 'removed');
	return {
		beforeSegments,
		afterSegments,
		segments: characters.segments,
		coarse: characters.coarse
	};
}

function sentences(value: string): string[] {
	// Keep delimiters and whitespace so either source can be reconstructed byte-for-byte.
	return value.match(/[^\n.!?。！？]*(?:[.!?。！？]+[ \t]*|\r?\n|$)/gu)?.filter(Boolean) ?? [];
}

export function buildRevisionTextDiff(beforeValue: string, afterValue: string) {
	const outer = sequenceDiff(sentences(beforeValue), sentences(afterValue));
	const blocks: RevisionTextBlock[] = [];
	let beforeText = '';
	let afterText = '';
	let coarse = outer.coarse;
	function flush() {
		if (!beforeText && !afterText) return;
		const diff = buildInlineDiffSegments(beforeText, afterText);
		coarse ||= diff.coarse;
		if (Math.max(beforeText.length, afterText.length) <= 600 || diff.coarse) {
			blocks.push({ kind: 'change', beforeText, afterText, diff });
		} else {
			// Unpunctuated source paragraphs also need collapsible unchanged intervals.
			let left = '';
			let right = '';
			const flushInner = () => {
				if (!left && !right) return;
				blocks.push({
					kind: 'change',
					beforeText: left,
					afterText: right,
					diff: buildInlineDiffSegments(left, right)
				});
				left = '';
				right = '';
			};
			for (const segment of diff.segments) {
				if (segment.kind === 'context' && Array.from(segment.text).length > 240) {
					flushInner();
					blocks.push({ kind: 'context', text: segment.text });
				} else {
					if (segment.kind !== 'added') left += segment.text;
					if (segment.kind !== 'removed') right += segment.text;
				}
			}
			flushInner();
		}
		beforeText = '';
		afterText = '';
	}
	for (const segment of outer.segments) {
		if (segment.kind === 'context') {
			flush();
			blocks.push({ kind: 'context', text: segment.text });
		} else if (segment.kind === 'removed') beforeText += segment.text;
		else afterText += segment.text;
	}
	flush();
	return { blocks, coarse, changeCount: blocks.filter((block) => block.kind === 'change').length };
}

export function splitRevisionContext(text: string, hasPrevious: boolean, hasNext: boolean) {
	const characters = Array.from(text);
	if (characters.length <= 240) return { start: text, hidden: '', end: '' };
	const startLength = hasPrevious ? 40 : 0;
	const endLength = hasNext ? 40 : 0;
	return {
		start: characters.slice(0, startLength).join(''),
		hidden: characters.slice(startLength, characters.length - endLength).join(''),
		end: endLength ? characters.slice(-endLength).join('') : ''
	};
}
