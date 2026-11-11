import {
	readDenseStages,
	readWorkerWaits,
	sidecarOperation,
	sidecarStatus,
	type SearchTiming
} from './search-timing.ts';
import { buildSearchWaterfall } from './search-waterfall.ts';

interface Metric {
	key: string;
	label: string;
	durationMs: number;
	startMs?: number;
	estimated?: boolean;
	depth: number;
}

const phases = {
	'': '왕복',
	'-total': 'Sidecar 전체',
	'-dense': 'Dense',
	'-annotate': 'Annotate'
};

function collectMetrics(timing: SearchTiming) {
	const backend = timing.backend;
	const occurrences = new Map<string, number>();
	const calls = (backend?.sidecarCalls ?? []).map((call) => {
		// A cached health check or a retry can shift the absolute call index.
		// Match only like-for-like attempts, in their occurrence order.
		const identity = JSON.stringify([
			call.path,
			call.chunkK,
			call.outcome,
			// Successful HTTP and gRPC attempts are the same logical operation.
			call.outcome === 'error' ? [call.transport, call.status, call.grpcCode] : null
		]);
		const count = (occurrences.get(identity) ?? 0) + 1;
		occurrences.set(identity, count);
		const status =
			sidecarStatus(call) ?? { ok: '완료', error: '실패', pending: '진행 중' }[call.outcome];
		const label = `${sidecarOperation(call)}${call.chunkK === undefined ? '' : ` · k=${call.chunkK}`} · ${status}${count > 1 ? ` · ${count}번째` : ''}`;
		return { key: `call:${identity}:${count}`, label, call };
	});
	const metrics = new Map<string, Metric>();
	for (const span of buildSearchWaterfall(timing).spans) {
		let { id: key, label } = span;
		const callMatch = /^call-(\d+)(-total|-dense(?:-\w+)*|-annotate)?$/.exec(key);
		const gapMatch = /^backend-gap-(\d+|end)$/.exec(key);
		if (callMatch) {
			const call = calls[Number(callMatch[1])];
			const phase = callMatch[2] ?? '';
			key = call.key + phase;
			label = `${call.label} · ${phases[phase as keyof typeof phases] ?? label.replace(/^#\d+ /, '')}`;
		} else if (gapMatch) {
			const next = gapMatch[1] === 'end' ? calls.length : Number(gapMatch[1]);
			key = JSON.stringify(['backend-gap', calls[next - 1]?.key, calls[next]?.key]);
		}
		metrics.set(key, {
			key,
			label,
			durationMs: span.durationMs,
			startMs: span.startMs,
			estimated: span.estimated,
			depth: span.depth
		});
	}
	const addUnplaced = (
		key: string,
		label: string,
		durationMs: number | undefined,
		depth: number
	) => {
		if (durationMs !== undefined && !metrics.has(key))
			metrics.set(key, { key, label, durationMs, depth });
	};
	addUnplaced('backend', 'Backend 처리', backend?.backendMs, 2);
	for (const { key, label, call } of calls) {
		addUnplaced(key, `${label} · ${phases['']}`, call.roundTripMs, 3);
		addUnplaced(key + '-total', `${label} · ${phases['-total']}`, call.timings?.totalMs, 4);
		for (const wait of readWorkerWaits(call.timings)) {
			addUnplaced(key + '-' + wait.key, `${label} · ${wait.label}`, wait.durationMs, 6);
		}
		addUnplaced(key + '-dense', `${label} · ${phases['-dense']}`, call.timings?.denseMs, 5);
		for (const stage of readDenseStages(call.timings) ?? []) {
			const stageKey = key + '-dense-' + stage.key;
			addUnplaced(stageKey, `${label} · ${stage.label}`, stage.durationMs, 6);
			for (const child of stage.children ?? []) {
				addUnplaced(stageKey + '-' + child.key, `${label} · ${child.label}`, child.durationMs, 7);
			}
		}
		addUnplaced(
			key + '-annotate',
			`${label} · ${phases['-annotate']}`,
			call.timings?.annotateMs,
			5
		);
	}
	return metrics;
}

export function compareSearchTimings(baseline: SearchTiming, latest: SearchTiming) {
	const before = collectMetrics(baseline);
	const after = collectMetrics(latest);
	const keys = [...after.keys()];
	let next = keys.length;
	for (const key of [...before.keys()].reverse()) {
		const index = keys.indexOf(key);
		if (index !== -1) next = index;
		else keys.splice(next, 0, key);
	}
	return {
		axisMs: Math.max(baseline.sveltekitMs, latest.sveltekitMs),
		rows: keys.map((key) => {
			const previous = before.get(key);
			const current = after.get(key);
			const deltaMs =
				previous && current
					? Number((current.durationMs - previous.durationMs).toFixed(2))
					: undefined;
			const label =
				previous && current && previous.label !== current.label
					? `${previous.label} → ${current.label}`
					: (current ?? previous)!.label;
			return { key, label, previous, current, deltaMs };
		})
	};
}
