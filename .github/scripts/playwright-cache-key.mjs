import { createHash } from 'node:crypto';
import { readFileSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function buildCacheIdentity(env, version, installerHash) {
	const engines = (env.BROWSER_SET ?? '').trim().split(/\s+/).sort();
	if (
		!engines.length ||
		engines.some((value) => !['chromium', 'firefox', 'webkit'].includes(value)) ||
		new Set(engines).size !== engines.length
	)
		throw new Error('Provide a nonempty set of unique supported browser names');
	for (const key of ['RUNNER_OS', 'RUNNER_ARCH', 'ImageOS', 'ImageVersion']) {
		if (!/^[a-zA-Z0-9._-]+$/.test(env[key] ?? ''))
			throw new Error(`Invalid runner identity: ${key}`);
	}
	if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))
		throw new Error('Invalid Playwright version');
	if (!/^[a-f0-9]{64}$/.test(installerHash)) throw new Error('Invalid installer digest');
	const platform = `${env.RUNNER_OS}-${env.RUNNER_ARCH}-${env.ImageOS}`;
	const scope = `${platform}-pw-${version}-${engines.join('-')}`;
	return {
		browsers: engines.join(' '),
		'apt-key': `apt-v2-${scope}-image-${env.ImageVersion}-${installerHash}`,
		'browser-key': `browsers-v2-${scope}-complete`
	};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const require = createRequire(import.meta.url);
	const version = require('playwright-core/package.json').version;
	const hash = createHash('sha256');
	for (const path of [
		'./install-browser-deps.sh',
		'./playwright-cache-key.mjs',
		'../actions/setup-playwright/action.yml'
	])
		hash.update(readFileSync(new URL(path, import.meta.url)));
	const identity = buildCacheIdentity(process.env, version, hash.digest('hex'));
	if (
		!process.env.GITHUB_OUTPUT ||
		!process.env.GITHUB_ENV ||
		!/^\/[^\r\n\0]*$/.test(process.env.RUNNER_TEMP ?? '')
	)
		throw new Error('GitHub output, environment and runner temporary paths are required');
	appendFileSync(
		process.env.GITHUB_OUTPUT,
		Object.entries(identity)
			.map(([key, value]) => `${key}=${value}\n`)
			.join('')
	);
	appendFileSync(
		process.env.GITHUB_ENV,
		`PLAYWRIGHT_BROWSERS_PATH=${process.env.RUNNER_TEMP}/ms-playwright\n`
	);
	console.log(
		`Playwright ${version}; browser set: ${identity.browsers}; runner image: ${process.env.ImageVersion}`
	);
}
