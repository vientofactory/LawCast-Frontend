import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse, type AST } from 'svelte/compiler';

const root = process.env.ICON_SOURCE_ROOT ?? 'src';
function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]
	);
}
function walk(node: unknown, visit: (node: AST.SvelteNode) => void): void {
	if (!node || typeof node !== 'object') return;
	if ('type' in node && typeof node.type === 'string') visit(node as AST.SvelteNode);
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
		else if (value && typeof value === 'object') walk(value, visit);
	}
}

test('decorative FontAwesome wrappers have no background or padded tiles', () => {
	const violations: string[] = [];
	for (const file of files(root).filter((path) => path.endsWith('.svelte'))) {
		const source = readFileSync(file, 'utf8');
		walk(parse(source, { modern: true }).fragment, (node) => {
			if (node.type !== 'RegularElement' || !['div', 'span'].includes(node.name)) return;
			const children = node.fragment.nodes.filter(
				(child) => child.type !== 'Comment' && !(child.type === 'Text' && !child.data.trim())
			);
			if (
				children.length !== 1 ||
				children[0].type !== 'Component' ||
				children[0].name !== 'FontAwesomeIcon'
			)
				return;
			const attribute = node.attributes.find(
				(attr) => attr.type === 'Attribute' && attr.name === 'class'
			);
			if (!attribute || attribute.type !== 'Attribute') return;
			const classes = source.slice(attribute.start, attribute.end);
			if (/\bbg-|\blc-chip-|\blc-icon-accent-|\brounded|\bp(?:x|y)?-\d/.test(classes)) {
				violations.push(`${file}:${source.slice(0, node.start).split('\n').length}`);
			}
		});
	}
	assert.deepEqual(violations, []);
});

test('shared decorative icon rules do not paint backplates', () => {
	const violations: string[] = [];
	for (const file of files(root).filter((path) => path.endsWith('.css'))) {
		const source = readFileSync(file, 'utf8');
		for (const rule of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
			if (
				/\.lc-(?:home-(?:signal|stat|foot)-icon|icon-accent-(?:primary|success)|empty-state-icon)\b/.test(
					rule[1]
				) &&
				/\bbackground(?:-color)?\s*:/.test(rule[2])
			) {
				violations.push(`${file}: ${rule[1].trim()}`);
			}
		}
	}
	assert.deepEqual(violations, []);
});
