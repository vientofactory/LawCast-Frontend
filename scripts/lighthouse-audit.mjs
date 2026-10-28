import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { launch } from 'chrome-launcher';

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
		assert: { type: 'boolean', default: false }
	}
});
const runs = Number(values.runs);
if (!Number.isInteger(runs) || runs < 1 || runs > 10)
	throw new Error('--runs must be between 1 and 10');
if (!['mobile', 'desktop'].includes(values['form-factor']))
	throw new Error('--form-factor must be mobile or desktop');
const origin = new URL(values.url);
if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('--url must use HTTP or HTTPS');
const outputDir = resolve(values['output-dir']);
await mkdir(outputDir, { recursive: true });
const results = [];
const failures = [];
const median = (numbers) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)];

// Run sequentially so other Lighthouse browsers never compete for CPU.
for (const route of values.routes.split(',')) {
	const url = new URL(route.trim(), origin);
	if (url.origin !== origin.origin) throw new Error('Routes must stay on the configured origin');
	const measurements = [];
	for (let run = 1; run <= runs; run++) {
		const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox'] });
		try {
			const result = await lighthouse(
				url.href,
				{
					port: chrome.port,
					logLevel: 'error',
					output: ['json', 'html']
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
			measurements.push({
				url: lhr.finalDisplayedUrl,
				fetchTime: lhr.fetchTime,
				lighthouseVersion: lhr.lighthouseVersion,
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
				`${url.pathname} ${values['form-factor']} ${run}/${runs}: performance ${lhr.categories.performance.score}, LCP ${Math.round(metrics['largest-contentful-paint'])}ms, CLS ${metrics['cumulative-layout-shift']}`
			);
		} catch (error) {
			failures.push({ url: url.href, run, error: String(error) });
			console.error(url.href, error);
		} finally {
			await chrome.kill();
		}
	}
	if (measurements.length) {
		const metrics = Object.fromEntries(
			Object.keys(measurements[0].metrics).map((id) => [
				id,
				median(measurements.map((item) => item.metrics[id]))
			])
		);
		results.push({ route, formFactor: values['form-factor'], metrics, measurements });
		if (
			values.assert &&
			(metrics['largest-contentful-paint'] > 2500 ||
				metrics['total-blocking-time'] > 200 ||
				metrics['cumulative-layout-shift'] > 0.1)
		)
			failures.push({ url: url.href, error: 'Median lab performance budget exceeded' });
	}
}
await writeFile(resolve(outputDir, 'summary.json'), JSON.stringify({ results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
