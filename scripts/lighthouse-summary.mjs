export function distribution(numbers, budget) {
	if (!numbers.length || numbers.some((value) => !Number.isFinite(value)))
		throw new Error('A distribution requires finite measurements');
	const sorted = [...numbers].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return {
		count: sorted.length,
		median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
		p75: sorted[Math.ceil(sorted.length * 0.75) - 1],
		max: sorted.at(-1),
		overBudget: sorted.filter((value) => value > budget).length
	};
}

export const budgets = {
	'largest-contentful-paint': 2500,
	'total-blocking-time': 200,
	'cumulative-layout-shift': 0.1
};

export function summarize(measurements) {
	return Object.fromEntries(
		Object.keys(measurements[0].metrics).map((id) => [
			id,
			distribution(
				measurements.map((item) => item.metrics[id]),
				budgets[id] ?? Infinity
			)
		])
	);
}
