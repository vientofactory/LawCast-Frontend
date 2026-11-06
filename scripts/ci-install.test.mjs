import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.env.CI_ROOT_UNDER_TEST || fileURLToPath(new URL('..', import.meta.url));
const script = join(root, '.github/scripts/install-browser-deps.sh');
const actionPath = join(root, '.github/actions/setup-playwright/action.yml');
const action = existsSync(actionPath) ? readFileSync(actionPath, 'utf8') : '';
const identityModule = () =>
	import(
		new URL(
			'../.github/scripts/playwright-cache-key.mjs',
			`file://${root}/scripts/ci-install.test.mjs`
		)
	);
const workflow = readFileSync(
	process.env.CI_WORKFLOW_UNDER_TEST || join(root, '.github/workflows/web-vitals.yml'),
	'utf8'
);

test('preserves every regression suite and fails rather than ignoring test errors', () => {
	for (const command of [
		'npm run lint && git diff --exit-code',
		'npm run check',
		'node --test scripts/lighthouse-summary.test.mjs',
		'node --test scripts/request-failure.test.mjs',
		'playwright-configs/playwright.config.ts e2e/revision-history.spec.ts e2e/revision-text-diff.spec.ts e2e/revision-history-pagination.spec.ts e2e/navigation-scroll.spec.ts',
		'npm run test:e2e:web-vitals',
		'playwright-configs/playwright.load-failures.config.ts',
		'playwright-configs/playwright.open-layout.config.ts',
		'playwright-configs/playwright.consumers.config.ts'
	])
		assert.ok(workflow.includes(command), command);
	assert.ok(workflow.includes('timeout-minutes: 25'));
	assert.doesNotMatch(workflow, /continue-on-error|\|\|\s*true/);
});

test('separates npm downloads, APT archives and compatible browser binaries', () => {
	assert.ok(workflow.includes('npm ci --prefer-offline'));
	assert.doesNotMatch(workflow + action, /path:\s*node_modules|restore-keys:|Dir::State/);
	assert.ok(workflow.includes('runs-on: ubuntu-24.04'));
	assert.equal((workflow.match(/uses: \.\/\.github\/actions\/setup-playwright/g) || []).length, 3);
	assert.equal((action.match(/actions\/cache\/restore@[a-f0-9]{40}/g) || []).length, 2);
	assert.equal((action.match(/actions\/cache\/save@[a-f0-9]{40}/g) || []).length, 2);
	assert.ok(action.includes('outputs.apt-key'));
	assert.ok(action.includes('outputs.browser-key'));
	assert.ok(action.includes('cache-primary-key'));
	assert.ok(action.includes('lawcast-apt-archives'));
	assert.ok(action.includes('ms-playwright'));
	assert.doesNotMatch(action, /node_modules|\/var\/lib|\/usr\/lib|dpkg/);
});

function runInstaller(exitCode = 0, invalidPath, browsers = ['chromium'], installer = script) {
	const directory = mkdtempSync(join(tmpdir(), 'lawcast-ci-install-'));
	const bin = join(directory, 'bin');
	const runner = invalidPath ?? join(directory, 'runner with spaces');
	mkdirSync(bin);
	if (!invalidPath) mkdirSync(runner);
	writeFileSync(
		join(bin, 'sudo'),
		`#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$SUDO_LOG"
if [[ "$1" == env ]]; then exec "$@"; fi
if [[ "$1" == chown ]]; then exit 0; fi
exit 91
`,
		{ mode: 0o755 }
	);
	writeFileSync(
		join(bin, 'npx'),
		`#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(process.env.NPX_LOG, JSON.stringify({ args: process.argv.slice(2), configPath: process.env.APT_CONFIG, config: fs.readFileSync(process.env.APT_CONFIG, 'utf8') }));
if (process.env.INSTALL_EXIT !== '0') process.exit(Number(process.env.INSTALL_EXIT));
const path = require('node:path');
fs.writeFileSync(path.join(process.env.RUNNER_TEMP, 'lawcast-apt-archives', 'font-fixture.deb'), 'fixture');
`,
		{ mode: 0o755 }
	);
	const result = spawnSync('bash', [installer, ...browsers], {
		encoding: 'utf8',
		env: {
			...process.env,
			PATH: bin + delimiter + process.env.PATH,
			RUNNER_TEMP: runner,
			INSTALL_EXIT: String(exitCode),
			SUDO_LOG: join(directory, 'sudo.log'),
			NPX_LOG: join(directory, 'npx.json')
		}
	});
	return {
		directory,
		runner,
		result,
		log: () => readFileSync(join(directory, 'sudo.log'), 'utf8'),
		invocation: () => JSON.parse(readFileSync(join(directory, 'npx.json'), 'utf8')),
		cleanup: () => rmSync(directory, { recursive: true, force: true })
	};
}

test('always installs system dependencies while retaining only downloaded package archives', () => {
	const probe = runInstaller();
	try {
		assert.equal(probe.result.status, 0, probe.result.stderr);
		const invocation = probe.invocation();
		assert.deepEqual(invocation.args, ['--no-install', 'playwright', 'install-deps', 'chromium']);
		assert.ok(
			invocation.config.includes(`Dir::Cache::archives "${probe.runner}/lawcast-apt-archives"`)
		);
		assert.ok(invocation.config.includes('Keep-Downloaded-Packages "true"'));
		assert.doesNotMatch(invocation.config, /AllowUnauthenticated|Check-Valid-Until|Dir::State/);
		assert.equal(existsSync(invocation.configPath), false);
		assert.match(probe.log(), /chown -R/);
		assert.match(probe.result.stdout, /APT package archives retained: 1/);
	} finally {
		probe.cleanup();
	}
});

test('propagates dependency installation failure and removes temporary configuration', () => {
	const probe = runInstaller(23);
	try {
		assert.equal(probe.result.status, 23);
		assert.doesNotMatch(probe.log(), /chown/);
		assert.equal(existsSync(probe.invocation().configPath), false);
	} finally {
		probe.cleanup();
	}
});

test('rejects invalid cache configuration paths before invoking privileged commands', () => {
	const probe = runInstaller(0, '/tmp/invalid"path');
	try {
		assert.equal(probe.result.status, 2);
		assert.equal(existsSync(join(probe.directory, 'sudo.log')), false);
	} finally {
		probe.cleanup();
	}
});

test('labels intentional HTTP errors without hiding application error output', () => {
	const config = readFileSync(
		join(root, 'playwright-configs/playwright.load-failures.config.ts'),
		'utf8'
	);
	const fixture = readFileSync(join(root, 'e2e/fixtures/load-failure-backend.mjs'), 'utf8');
	assert.ok(config.includes("stdout: 'pipe'"));
	assert.doesNotMatch(config, /stderr:\s*'ignore'/);
	assert.ok(fixture.includes('intentional HTTP 429 injection'));
	assert.ok(workflow.includes('notice title=Intentional HTTP failures'));
});

test('runs specialized shared UI suites in independent cross-engine jobs', () => {
	assert.match(workflow, /shared-ui:[\s\S]*fail-fast: false/);
	assert.match(workflow, /suite: \[notifications, screenshot-modal, theme-states\]/);
	assert.match(workflow, /needs: prepare-shared-browsers/);
	assert.equal((workflow.match(/browsers: chromium firefox webkit/g) || []).length, 2);
	assert.ok(workflow.indexOf('prepare-shared-browsers:') < workflow.indexOf('  shared-ui:'));
	assert.ok(action.includes('install-browser-deps.sh'));
	assert.ok(action.includes('npx --no-install playwright install'));
	assert.ok(workflow.includes('playwright.${{ matrix.suite }}.config.ts'));
	assert.match(workflow, /if: failure\(\)/);
	assert.match(workflow, /retention-days: 7/);
});

test('assigns screenshot touch cases to a touch device in every general discovery config', () => {
	for (const name of ['playwright.config.ts', 'playwright.config.integration.ts']) {
		const source = readFileSync(join(root, 'playwright-configs', name), 'utf8');
		assert.match(source, /name: 'chromium',[\s\S]*grepInvert: \/touch screenshot viewport\//);
		assert.match(source, /name: 'chromium-touch',[\s\S]*grep: \/touch screenshot viewport\//);
		assert.ok(source.includes("devices['Pixel 7']"));
	}
});

test('installs every requested browser dependency and preserves the Chromium wrapper', () => {
	for (const [browsers, installer] of [
		[['chromium', 'firefox', 'webkit'], script],
		[['chromium'], join(root, '.github/scripts/install-chromium-deps.sh')]
	]) {
		const probe = runInstaller(0, undefined, browsers, installer);
		try {
			assert.equal(probe.result.status, 0, probe.result.stderr);
			assert.deepEqual(probe.invocation().args, [
				'--no-install',
				'playwright',
				'install-deps',
				...browsers
			]);
		} finally {
			probe.cleanup();
		}
	}
});

test('rejects empty and unsupported browser sets before privilege escalation', () => {
	for (const browsers of [[], ['--with-deps'], ['firefox;echo'], ['chrome']]) {
		const probe = runInstaller(0, undefined, browsers);
		try {
			assert.equal(probe.result.status, 2);
			assert.equal(existsSync(join(probe.directory, 'sudo.log')), false);
		} finally {
			probe.cleanup();
		}
	}
});

const runner = {
	BROWSER_SET: 'chromium firefox webkit',
	RUNNER_OS: 'Linux',
	RUNNER_ARCH: 'X64',
	ImageOS: 'ubuntu24',
	ImageVersion: '20261101.1.0'
};
const digest = 'a'.repeat(64);

test('keys reuse equivalent engine sets and isolate partial engine caches', async () => {
	const { buildCacheIdentity } = await identityModule();
	const full = buildCacheIdentity(runner, '1.62.1', digest);
	assert.deepEqual(
		buildCacheIdentity({ ...runner, BROWSER_SET: 'webkit chromium firefox' }, '1.62.1', digest),
		full
	);
	const single = buildCacheIdentity({ ...runner, BROWSER_SET: 'chromium' }, '1.62.1', digest);
	assert.notEqual(single['apt-key'], full['apt-key']);
	assert.notEqual(single['browser-key'], full['browser-key']);
	// Cache actions also try primary-key prefix matches without explicit restore keys.
	assert.equal(full['browser-key'].startsWith(single['browser-key']), false);
	assert.equal(single['browser-key'].startsWith(full['browser-key']), false);
});

test('keys invalidate on platform and Playwright changes', async () => {
	const { buildCacheIdentity } = await identityModule();
	const base = buildCacheIdentity(runner, '1.62.1', digest);
	for (const [key, value] of [
		['RUNNER_OS', 'Windows'],
		['RUNNER_ARCH', 'ARM64'],
		['ImageOS', 'ubuntu26']
	]) {
		const next = buildCacheIdentity({ ...runner, [key]: value }, '1.62.1', digest);
		assert.notEqual(next['apt-key'], base['apt-key']);
		assert.notEqual(next['browser-key'], base['browser-key']);
	}
	const upgraded = buildCacheIdentity(runner, '1.63.0', digest);
	assert.notEqual(upgraded['apt-key'], base['apt-key']);
	assert.notEqual(upgraded['browser-key'], base['browser-key']);
});

test('APT keys track image revisions and installer changes without redownloading compatible browsers', async () => {
	const { buildCacheIdentity } = await identityModule();
	const base = buildCacheIdentity(runner, '1.62.1', digest);
	for (const next of [
		buildCacheIdentity({ ...runner, ImageVersion: '20261102.1.0' }, '1.62.1', digest),
		buildCacheIdentity(runner, '1.62.1', 'b'.repeat(64))
	]) {
		assert.notEqual(next['apt-key'], base['apt-key']);
		assert.equal(next['browser-key'], base['browser-key']);
	}
});

test('rejects ambiguous identities instead of restoring incompatible downloads', async () => {
	const { buildCacheIdentity } = await identityModule();
	for (const BROWSER_SET of ['', 'chromium chromium', 'chromium --help', 'chrome'])
		assert.throws(() => buildCacheIdentity({ ...runner, BROWSER_SET }, '1.62.1', digest));
	assert.throws(() => buildCacheIdentity({ ...runner, ImageVersion: '' }, '1.62.1', digest));
	assert.throws(() => buildCacheIdentity(runner, 'unknown', digest));
	assert.throws(() => buildCacheIdentity(runner, '1.62.1', 'invalid'));
});

test('cache hits never bypass installation, browser validation or regression tests', () => {
	for (const name of ['Install system dependencies', 'Verify or install browsers']) {
		const step = action.split(`- name: ${name}`)[1]?.split('    - name:')[0];
		assert.ok(step, name);
		assert.doesNotMatch(step, /if:/);
	}
	assert.ok(
		action.indexOf('name: Install system dependencies') <
			action.indexOf('name: Save APT package archives')
	);
	assert.ok(
		action.indexOf('name: Verify or install browsers') <
			action.indexOf('name: Save browser binaries')
	);
	assert.doesNotMatch(
		action + workflow,
		/continue-on-error|\|\|\s*true|skip.*test:|timeout-minutes: 3[0-9]/
	);
	assert.equal((workflow.match(/timeout-minutes: 25/g) || []).length, 3);
});

test('writes installed-version cache identities and runtime browser paths without output injection', () => {
	const directory = mkdtempSync(join(tmpdir(), 'lawcast-cache-identity-'));
	try {
		const output = join(directory, 'output');
		const envFile = join(directory, 'environment');
		const command = join(root, '.github/scripts/playwright-cache-key.mjs');
		const result = spawnSync(process.execPath, [command], {
			encoding: 'utf8',
			env: {
				...process.env,
				...runner,
				RUNNER_TEMP: directory,
				GITHUB_OUTPUT: output,
				GITHUB_ENV: envFile
			}
		});
		assert.equal(result.status, 0, result.stderr);
		const version = JSON.parse(
			readFileSync(join(root, 'node_modules/playwright-core/package.json'), 'utf8')
		).version;
		const values = readFileSync(output, 'utf8');
		assert.ok(values.includes(`-pw-${version}-chromium-firefox-webkit`));
		assert.match(values, /^browsers=chromium firefox webkit$/m);
		assert.equal(
			readFileSync(envFile, 'utf8'),
			`PLAYWRIGHT_BROWSERS_PATH=${directory}/ms-playwright\n`
		);
		const rejectedOutput = join(directory, 'rejected-output');
		const rejected = spawnSync(process.execPath, [command], {
			encoding: 'utf8',
			env: {
				...process.env,
				...runner,
				RUNNER_TEMP: directory + '\nINJECTED=true',
				GITHUB_OUTPUT: rejectedOutput,
				GITHUB_ENV: envFile
			}
		});
		assert.notEqual(rejected.status, 0);
		assert.equal(existsSync(rejectedOutput), false);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
