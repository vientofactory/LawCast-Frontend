import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = join(root, '.github/scripts/install-chromium-deps.sh');
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

test('separates npm downloads, APT archives and versioned browser binaries', () => {
	assert.ok(workflow.includes('npm ci --prefer-offline'));
	assert.doesNotMatch(workflow, /path:\s*node_modules/);
	assert.ok(workflow.includes('runs-on: ubuntu-24.04'));
	assert.ok(workflow.includes("require('playwright-core/package.json').version"));
	assert.ok(workflow.includes('outputs.image }}-pw-'));
	assert.ok(workflow.includes('outputs.image-os }}-pw-'));
	assert.equal((workflow.match(/actions\/cache\/restore@[a-f0-9]{40}/g) || []).length, 2);
	assert.equal((workflow.match(/actions\/cache\/save@[a-f0-9]{40}/g) || []).length, 2);
	assert.ok(
		workflow.indexOf('name: Save Chromium binaries') <
			workflow.indexOf('name: Test revision history')
	);
	assert.match(workflow, /name: Install Chromium system dependencies\n\s+run: bash/);
	assert.match(
		workflow,
		/name: Verify or install Chromium\n\s+run: npx --no-install playwright install chromium/
	);
});

function runInstaller(exitCode = 0, invalidPath) {
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
	const result = spawnSync('bash', [script], {
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
