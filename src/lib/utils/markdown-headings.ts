/** Normalize body heading levels without modifying tokens or losing nested heading order. */
export function buildMarkdownHeadingLevels(tokens: unknown): Map<object, number> {
	const levels = new Map<object, number>();
	let offset: number | undefined;
	let previous = 1;
	function visit(value: unknown) {
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		if (!value || typeof value !== 'object') return;
		const token = value as Record<string, unknown>;
		if (token.type === 'heading') {
			const depth = typeof token.depth === 'number' && token.depth > 0 ? token.depth : 1;
			offset ??= 2 - depth;
			const level = Math.min(6, previous + 1, Math.max(2, depth + offset));
			levels.set(value, level);
			previous = level;
		}
		for (const key of ['tokens', 'items', 'header', 'rows', 'summaryTokens']) visit(token[key]);
	}
	visit(tokens);
	return levels;
}
