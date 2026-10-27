import { satori } from '@cf-wasm/satori';
import type { ReactNode } from 'react';
import { Resvg } from '@cf-wasm/resvg';
import brandLogo from '../../../static/brand/logo-light.svg?raw';

/**
 * Renders the Open Graph share image for a single bill as a PNG.
 *
 * Design: a light diagonal gradient over a faint 48px grid, the bill name as
 * the headline, the `소관위원회` / `입법예고 기간` / `제안자` fields as label-value
 * rows, and the LawCast logo on top.
 *
 * Rendering uses the @cf-wasm wrappers instead of satori/@resvg/resvg-wasm
 * directly: Cloudflare Workers forbids compiling WASM from raw bytes at
 * runtime ("Wasm code generation disallowed by embedder"), while the @cf-wasm
 * packages import their .wasm files as static ESM modules that wrangler
 * pre-compiles at deploy. The node condition of those packages handles the
 * Vite dev server.
 */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export type BillOgImageContent = {
	title: string;
	aiSummary?: string | null;
	committee: string;
	noticePeriod: string;
	proposer: string;
};

// The font lives in static/og/ and is fetched from our own origin, which works
// identically under the Vite dev server and Cloudflare Pages. Filesystem reads
// would break on Workers.
const FONT_PATH = '/og/fonts/Pretendard-Regular.otf';
const FONT_FAMILY = 'Pretendard';

const COLORS = {
	ink: '#0f172a',
	value: '#1e293b',
	muted: '#64748b',
	grid: 'rgba(15, 23, 42, 0.05)',
	divider: 'rgba(15, 23, 42, 0.12)'
};

const GRID_STEP = 48;

// satori's public API is typed against React's nodes; building the tree with
// plain objects keeps this module free of a React runtime dependency. Like
// JSX, a single child is stored as the value itself (not a one-element array)
// and no child omits the key entirely — satori only permits array children on
// flex/contents/none containers.
function h(type: string, props: Record<string, unknown>, ...children: ReactNode[]): ReactNode {
	if (children.length === 0) {
		return { type, props, key: null };
	}
	const child = children.length === 1 ? children[0] : children;
	return { type, props: { ...props, children: child }, key: null };
}

const assetCache = new Map<string, Promise<ArrayBuffer>>();

/** Fetches a static/ asset once per process and reuses the promise. */
function loadAsset(origin: string, path: string): Promise<ArrayBuffer> {
	const key = `${origin}${path}`;
	let pending = assetCache.get(key);
	if (!pending) {
		pending = fetch(new URL(path, origin)).then((response) => {
			if (!response.ok) {
				throw new Error(`OG image asset ${path} unavailable (HTTP ${response.status})`);
			}
			return response.arrayBuffer();
		});
		assetCache.set(key, pending);
		// A transient failure must not poison every later render.
		pending.catch(() => assetCache.delete(key));
	}
	return pending;
}

function buildGridLines(): ReactNode[] {
	const lines: ReactNode[] = [];
	for (let x = GRID_STEP; x < OG_IMAGE_WIDTH; x += GRID_STEP) {
		lines.push(
			h('div', {
				style: {
					position: 'absolute',
					top: 0,
					bottom: 0,
					left: x,
					width: 1,
					backgroundColor: COLORS.grid
				}
			})
		);
	}
	for (let y = GRID_STEP; y < OG_IMAGE_HEIGHT; y += GRID_STEP) {
		lines.push(
			h('div', {
				style: {
					position: 'absolute',
					left: 0,
					right: 0,
					top: y,
					height: 1,
					backgroundColor: COLORS.grid
				}
			})
		);
	}
	return lines;
}

// Satori applies lineClamp only to text nodes with display: block.
function buildFieldRow(label: string, value: string, compact: boolean): ReactNode {
	return h(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'row',
				alignItems: 'flex-start',
				marginTop: compact ? 12 : 16,
				flexShrink: 0
			}
		},
		h(
			'div',
			{
				style: {
					width: 170,
					flexShrink: 0,
					fontSize: 23,
					lineHeight: '34px',
					color: COLORS.muted
				}
			},
			label
		),
		h(
			'div',
			{
				style: {
					display: 'block',
					flex: '1 1 auto',
					fontSize: compact ? 24 : 28,
					lineHeight: compact ? '32px' : '36px',
					color: COLORS.value,
					lineClamp: compact ? 1 : 2
				}
			},
			value || '-'
		)
	);
}

function buildTree(content: BillOgImageContent): ReactNode {
	const aiSummary = content.aiSummary?.trim();
	const hasSummary = !!aiSummary;
	const header = h(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'space-between',
				flexShrink: 0,
				marginBottom: 28
			}
		},
		h('img', {
			src: `data:image/svg+xml;base64,${btoa(brandLogo)}`,
			width: 259,
			height: 64
		}),
		h('div', { style: { fontSize: 22, color: COLORS.muted } }, '국회 입법예고 스냅샷 아카이브')
	);

	const title = h(
		'div',
		{
			style: {
				display: 'block',
				fontSize: 44,
				lineHeight: '58px',
				letterSpacing: '-0.5px',
				color: COLORS.ink,
				flexShrink: 0,
				lineClamp: 3
			}
		},
		content.title || '법률안 입법예고'
	);

	const summary = hasSummary
		? h(
				'div',
				{
					style: {
						display: 'flex',
						flexDirection: 'column',
						flexShrink: 0,
						marginTop: 16
					}
				},
				h(
					'div',
					{
						style: {
							display: 'block',
							fontSize: 24,
							lineHeight: '34px',
							color: COLORS.value,
							lineClamp: 2
						}
					},
					aiSummary
				)
			)
		: null;

	const infoBlock = h(
		'div',
		{ style: { display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: 'auto' } },
		h('div', {
			style: { height: 1, backgroundColor: COLORS.divider, marginTop: hasSummary ? 16 : 24 }
		}),
		buildFieldRow('소관위원회', content.committee, hasSummary),
		buildFieldRow('입법예고 기간', content.noticePeriod, hasSummary),
		buildFieldRow('제안자', content.proposer, hasSummary)
	);

	return h(
		'div',
		{
			style: {
				position: 'relative',
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				height: '100%',
				padding: '48px 64px',
				backgroundColor: '#f8fafc',
				backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 55%, #e0e7ff 100%)',
				fontFamily: FONT_FAMILY,
				fontWeight: 400,
				color: COLORS.ink
			}
		},
		...buildGridLines(),
		h(
			'div',
			{
				style: {
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					flex: '1 1 auto'
				}
			},
			header,
			title,
			...(summary ? [summary] : []),
			infoBlock
		)
	);
}

/** Renders the bill share image and returns PNG bytes (1200x630). */
export async function renderBillOgImage(
	content: BillOgImageContent,
	origin: string
): Promise<Uint8Array> {
	const fontData = await loadAsset(origin, FONT_PATH);
	const svg = await satori(buildTree(content), {
		width: OG_IMAGE_WIDTH,
		height: OG_IMAGE_HEIGHT,
		fonts: [{ name: FONT_FAMILY, data: fontData, weight: 400, style: 'normal' }]
	});
	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_IMAGE_WIDTH } });
	return resvg.render().asPng();
}
