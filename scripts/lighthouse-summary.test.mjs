import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distribution, summarize } from './lighthouse-summary.mjs';

test('retains a slow tail that the median budget would miss', () => {
	const samples = [1000, 1100, 1200, 3495].map((value) => ({
		metrics: { 'largest-contentful-paint': value }
	}));
	assert.deepEqual(summarize(samples)['largest-contentful-paint'], {
		count: 4,
		median: 1150,
		p75: 1200,
		max: 3495,
		overBudget: 1
	});
});

test('handles single runs and inclusive budget boundaries without mutating samples', () => {
	assert.deepEqual(distribution([2500], 2500), {
		count: 1,
		median: 2500,
		p75: 2500,
		max: 2500,
		overBudget: 0
	});
	const samples = [3100, 1000, 2500];
	assert.equal(distribution(samples, 2500).overBudget, 1);
	assert.deepEqual(samples, [3100, 1000, 2500]);
});

test('rejects absent or invalid observations instead of reporting a passing sample', () => {
	for (const samples of [[], [NaN], [undefined], [Infinity]]) {
		assert.throws(() => distribution(samples, 2500));
	}
});
