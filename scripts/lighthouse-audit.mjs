import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { launch, Launcher } from 'chrome-launcher';
import { saveAssets } from 'lighthouse/core/lib/asset-saver.js';
import { budgets, summarize } from './lighthouse-summary.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'https://law.viento.me' },
		routes: {
			type: 'string',
			default:
				'/,/notices,/notices/changes,/discussions,/proposals,/webhook,/status,/announcements,/crawling-transparency,/license'
		},
		runs: { type: 'string', default: '3' },
		'form-factor': { type: 'string', default: 'mobile' },
		'output-dir': { type: 'string', default: 'lighthouse-reports' },
		assert: { type: 'boolean', default: false },
		'assert-every-run': { type: 'boolean', default: false },
		'save-assets': { type: 'boolean', default: false },
		'throttling-method': { type: 'string', default: 'simulate' },
		'browser-profile': { type: 'string', default: 'stock' }
	}
});
const runs = Number(values.runs);
if (!Number.isInteger(runs) || runs < 1 || runs > 10)
	throw new Error('--runs must be between 1 and 10');
if (!['mobile', 'desktop'].includes(values['form-factor']))
	throw new Error('--form-factor must be mobile or desktop');
if (!['simulate', 'devtools', 'provided'].includes(values['throttling-method']))
	throw new Error('--throttling-method must be simulate, devtools or provided');
if (!['stock', 'render-document'].includes(values['browser-profile']))
	throw new Error('--browser-profile must be stock or render-document');
const origin = new URL(values.url);
if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('--url must use HTTP or HTTPS');
const outputDir = resolve(values['output-dir']);
await mkdir(outputDir, { recursive: true });
const results = [];
const failures = [];
// Preserve every launcher default except the explicitly selected diagnostic feature.
const diagnosticFlags = Launcher.defaultFlags().map((flag) =>
	flag.startsWith('--disable-features=')
		? flag
				.split(',')
				.filter((feature) => feature !== 'RenderDocument')
				.join(',')
		: flag
);

// Run sequentially so other Lighthouse browsers never compete for CPU.
for (const route of values.routes.split(',')) {
	const url = new URL(route.trim(), origin);
	if (url.origin !== origin.origin) throw new Error('Routes must stay on the configured origin');
	const measurements = [];
	for (let run = 1; run <= runs; run++) {
		const chrome = await launch(
			values['browser-profile'] === 'stock'
				? { chromeFlags: ['--headless', '--no-sandbox'] }
				: {
						ignoreDefaultFlags: true,
						chromeFlags: [...diagnosticFlags, '--headless', '--no-sandbox']
					}
		);
		try {
			const result = await lighthouse(
				url.href,
				{
					port: chrome.port,
					logLevel: 'error',
					output: ['json', 'html'],
					throttlingMethod: values['throttling-method'],
					...(values['save-assets']
						? {
								additionalTraceCategories: 'viz,cc,gpu,disabled-by-default-devtools.timeline.frame'
							}
						: {})
				},
				values['form-factor'] === 'desktop' ? desktopConfig : undefined
			);
			if (!result) throw new Error('Lighthouse returned no report');
			const name = `${url.pathname.replace(/[^a-zA-Z0-9-]/g, '_') || 'home'}-${values['form-factor']}-${run}`;
			await Promise.all(
				result.report.map((report, index) =>
					writeFile(resolve(outputDir, `${name}.${index === 0 ? 'json' : 'html'}`), report)
				)
			);
			if (values['save-assets'])
				await saveAssets(result.artifacts, result.lhr.audits, resolve(outputDir, name));
			const { lhr } = result;
			if (lhr.runtimeError) throw new Error(lhr.runtimeError.message);
			const metrics = Object.fromEntries(
				[
					'first-contentful-paint',
					'largest-contentful-paint',
					'total-blocking-time',
					'cumulative-layout-shift'
				].map((id) => [id, lhr.audits[id].numericValue])
			);
			if (Object.values(metrics).some((value) => !Number.isFinite(value)))
				throw new Error('Lighthouse did not produce all required numeric metrics');
			const documentResponse = result.artifacts.DevtoolsLog.findLast(
				(entry) =>
					entry.method === 'Network.responseReceived' &&
					entry.params.type === 'Document' &&
					entry.params.response.url === lhr.finalDisplayedUrl
			)?.params.response;
			const responseHeaders = Object.fromEntries(
				Object.entries(documentResponse?.headers ?? {}).map(([name, value]) => [
					name.toLowerCase(),
					value
				])
			);
			measurements.push({
				url: lhr.finalDisplayedUrl,
				fetchTime: lhr.fetchTime,
				lighthouseVersion: lhr.lighthouseVersion,
				browserUserAgent: lhr.environment.hostUserAgent,
				browserProfile: values['browser-profile'],
				throttlingMethod: lhr.configSettings.throttlingMethod,
				observed: lhr.audits.metrics.details.items[0],
				document: {
					status: documentResponse?.status,
					protocol: documentResponse?.protocol,
					requestTiming: documentResponse?.timing,
					serverResponseTime: lhr.audits['server-response-time'].numericValue,
					serverTiming: responseHeaders['server-timing'],
					cfCacheStatus: responseHeaders['cf-cache-status'],
					cfRay: responseHeaders['cf-ray']
				},
				scores: Object.fromEntries(
					Object.entries(lhr.categories).map(([id, category]) => [id, category.score])
				),
				metrics,
				warnings: lhr.runWarnings,
				failedAudits: Object.entries(lhr.audits)
					.filter(([, audit]) => audit.score !== null && audit.score < 1)
					.map(([id, audit]) => ({ id, title: audit.title, displayValue: audit.displayValue }))
			});
			console.log(
				`${url.pathname} ${values['form-factor']} ${run}/${runs} [${values['browser-profile']}/${values['throttling-method']}]: performance ${lhr.categories.performance.score}, LCP ${Math.round(metrics['largest-contentful-paint'])}ms, observed LCP ${Math.round(lhr.audits.metrics.details.items[0].observedLargestContentfulPaint)}ms, CLS ${metrics['cumulative-layout-shift']}`
			);
		} catch (error) {
			failures.push({ url: url.href, run, error: String(error) });
			console.error(url.href, error);
		} finally {
			await chrome.kill();
		}
	}
	if (measurements.length) {
		const distributions = summarize(measurements);
		const metrics = Object.fromEntries(
			Object.entries(distributions).map(([id, stats]) => [id, stats.median])
		);
		results.push({
			route,
			formFactor: values['form-factor'],
			metrics,
			distributions,
			measurements
		});
		if (
			values.assert &&
			(metrics['largest-contentful-paint'] > 2500 ||
				metrics['total-blocking-time'] > 200 ||
				metrics['cumulative-layout-shift'] > 0.1)
		)
			failures.push({ url: url.href, error: 'Median lab performance budget exceeded' });
		if (
			values['assert-every-run'] &&
			Object.keys(budgets).some((id) => distributions[id].overBudget > 0)
		)
			failures.push({ url: url.href, error: 'Individual lab performance budget exceeded' });
	}
}
await writeFile(resolve(outputDir, 'summary.json'), JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
