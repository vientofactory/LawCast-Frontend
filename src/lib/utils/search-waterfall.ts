import { readDenseStages, type SearchTiming } from './search-timing.ts';

type SpanKind = 'frontend' | 'backend' | 'request' | 'sidecar' | 'phase';

interface Span {
	id: string;
	label: string;
	startMs: number;
	durationMs: number;
	depth: number;
	kind: SpanKind;
	estimated?: boolean;
	detail?: boolean;
}

const ROUNDING_MS = 0.02;

export function buildSearchWaterfall(timing: SearchTiming) {
	const total = timing.sveltekitMs;
	const overhead: Pick<Span, 'id' | 'label' | 'durationMs'>[] = [];
	const spans: Span[] = [
		{
			id: 'total',
			label: 'SvelteKit 전체',
			startMs: 0,
			durationMs: total,
			depth: 0,
			kind: 'frontend'
		}
	];
	const backend = timing.backend;
	const headers = timing.headersReceivedMs;
	const sent = timing.fetchStartedMs;
	if (
		sent !== undefined &&
		headers !== undefined &&
		headers >= sent &&
		headers <= total + ROUNDING_MS
	) {
		const headerEnd = Math.min(headers, total);
		const canPositionBackend = backend && backend.backendMs <= headers - sent + ROUNDING_MS;
		spans.push({
			id: 'headers',
			label: 'SvelteKit → Backend 응답 헤더',
			startMs: sent,
			durationMs: Math.max(0, headerEnd - sent),
			depth: 1,
			kind: 'frontend',
			detail: !canPositionBackend
		});
		if (canPositionBackend) {
			// The two monotonic clocks are independent. Place the backend midway
			// between the earliest and latest possible starts, not at a wall-clock timestamp.
			const backendStart = sent + Math.max(0, headers - sent - backend.backendMs) / 2;
			overhead.push({
				id: 'headers',
				label: 'SvelteKit ↔ Backend 왕복 중 내부 처리 외',
				durationMs: Math.max(0, headers - sent - backend.backendMs)
			});
			const calls = backend.sidecarCalls;
			spans.push({
				id: 'backend',
				label: 'Backend 처리',
				startMs: backendStart,
				durationMs: backend.backendMs,
				depth: 2,
				kind: 'backend',
				estimated: true,
				detail: calls.length > 0 && calls.every((call) => call.startMs === undefined)
			});
			const complete =
				backend.omittedCalls === 0 &&
				calls.every(
					(call) =>
						call.startMs !== undefined &&
						call.roundTripMs !== undefined &&
						call.startMs + call.roundTripMs <= backend.backendMs + ROUNDING_MS
				);
			let cursor = 0;
			const gap = (end: number, id: string) => {
				if (!complete || end - cursor <= ROUNDING_MS) return;
				spans.push({
					id,
					label: 'Backend 기타 처리',
					startMs: backendStart + cursor,
					durationMs: end - cursor,
					depth: 3,
					kind: 'backend',
					estimated: true,
					detail: true
				});
			};
			for (const [index, call] of calls.entries()) {
				const { startMs, roundTripMs, timings } = call;
				if (
					startMs === undefined ||
					roundTripMs === undefined ||
					startMs + roundTripMs > backend.backendMs + ROUNDING_MS
				)
					continue;
				gap(startMs, `backend-gap-${index}`);
				cursor = Math.max(cursor, startMs + roundTripMs);
				const id = `call-${index}`;
				const prefix = `#${index + 1}`;
				const start = backendStart + startMs;
				const hasPhases =
					timings &&
					timings.totalMs <= roundTripMs + ROUNDING_MS &&
					timings.denseMs + timings.annotateMs <= timings.totalMs + ROUNDING_MS;
				spans.push({
					id,
					label: `${prefix} ${call.path} 왕복`,
					startMs: start,
					durationMs: roundTripMs,
					depth: 3,
					kind: 'request',
					estimated: true,
					detail: !hasPhases
				});
				if (hasPhases) {
					overhead.push({
						id,
						label: `${prefix} Sidecar 왕복 중 내부 처리 외`,
						durationMs: Math.max(0, roundTripMs - timings.totalMs)
					});
					// Dense and Annotate are sequential on the sidecar clock. Only
					// their placement within the round trip is estimated.
					const sidecarStart = start + Math.max(0, roundTripMs - timings.totalMs) / 2;
					const stages = readDenseStages(timings);
					if (stages) {
						overhead.push({
							id: `${id}-dense`,
							label: `${prefix} Dense 기타 처리`,
							durationMs: Math.max(
								0,
								timings.denseMs - stages.reduce((sum, stage) => sum + stage.durationMs, 0)
							)
						});
					}
					spans.push(
						{
							id: `${id}-total`,
							label: `${prefix} Sidecar 전체`,
							startMs: sidecarStart,
							durationMs: timings.totalMs,
							depth: 4,
							kind: 'sidecar',
							estimated: true
						},
						{
							id: `${id}-dense`,
							label: `${prefix} Dense`,
							startMs: sidecarStart,
							durationMs: timings.denseMs,
							depth: 5,
							kind: 'phase',
							estimated: true,
							detail: !stages
						},
						...(stages ?? []).flatMap((stage): Span[] => [
							{
								id: `${id}-dense-${stage.key}`,
								label: `${prefix} ${stage.label}`,
								startMs: sidecarStart + stage.startMs,
								durationMs: stage.durationMs,
								depth: 6,
								kind: 'phase',
								estimated: true,
								detail: !stage.children
							},
							...(stage.children ?? []).map((child): Span => ({
								id: `${id}-dense-${stage.key}-${child.key}`,
								label: `${prefix} ${child.label}`,
								startMs: sidecarStart + stage.startMs + child.startMs,
								durationMs: child.durationMs,
								depth: 7,
								kind: 'phase',
								estimated: true,
								detail: true
							}))
						]),
						{
							id: `${id}-annotate`,
							label: `${prefix} Annotate`,
							startMs: sidecarStart + timings.denseMs,
							durationMs: timings.annotateMs,
							depth: 5,
							kind: 'phase',
							estimated: true,
							detail: true
						}
					);
				}
			}
			gap(backend.backendMs, 'backend-gap-end');
		}
		spans.push({
			id: 'body',
			label: 'SvelteKit 응답 본문 처리',
			startMs: headerEnd,
			durationMs: total - headerEnd,
			depth: 1,
			kind: 'frontend',
			detail: true
		});
	}
	let longest: Pick<Span, 'id' | 'label' | 'durationMs'> | undefined;
	for (const span of [...spans.filter(({ detail }) => detail), ...overhead]) {
		if (span.durationMs > (longest?.durationMs ?? 0)) longest = span;
	}
	return { spans, longest, total };
}
