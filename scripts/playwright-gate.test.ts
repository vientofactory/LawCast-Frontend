import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	mkdtempSync,
	writeFileSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const hook = resolve('.githooks/pre-commit');
// Hook tests must not inherit Git paths pointing at the caller's repository.
const fixtureEnv: NodeJS.ProcessEnv = Object.fromEntries(
	Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
);
const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
	scripts: Record<string, string>;
};

test('covers every Playwright config and both PWA runtimes without test filters', () => {
	const commands = manifest.scripts['test:e2e:all'].split(' && ');
	assert.equal(commands.shift(), 'npm run test:unit');
	const expected = readdirSync('playwright-configs').filter((name) => name.endsWith('.ts'));
	const actual = commands.map((command) => command.match(/--config playwright-configs\/(\S+)/)![1]);
	assert.deepEqual([...new Set(actual)].sort(), expected.sort());
	assert.equal(actual.filter((name) => name === 'playwright.pwa.config.ts').length, 2);
	assert.ok(commands.some((command) => command.startsWith('PWA_CLOUDFLARE=0 ')));
	assert.ok(commands.some((command) => command.startsWith('PWA_CLOUDFLARE=1 ')));
	for (const command of commands) {
		assert.match(
			command,
			command.includes('playwright.config.integration.ts')
				? /DIFFCHAIN_UI_MOCK=0/
				: /DIFFCHAIN_UI_MOCK=1/
		);
		assert.match(command, /--forbid-only --retries=0$/);
		assert.doesNotMatch(
			command,
			/--(?:grep|project|shard|last-failed|only-changed)\b|e2e\/.*\.spec\.ts/
		);
	}
	assert.match(
		readFileSync('playwright-configs/playwright.ip-forwarding.config.ts', 'utf8'),
		/DIFFCHAIN_UI_MOCK: '0'/
	);
	assert.ok(
		commands.some((command) =>
			command.startsWith('env -u PLAYWRIGHT_BASE_URL DIFFCHAIN_UI_MOCK=0 ')
		)
	);
	assert.ok(commands.some((command) => command.startsWith('env -u WEB_VITALS_BASE_URL ')));
	for (const flag of [
		'E2E_CF_CHALLENGE',
		'E2E_IP_ECHO',
		'E2E_NSM_DEGRADED',
		'E2E_RATE_LIMIT_SIM',
		'E2E_SEMANTIC_SEARCH'
	])
		assert.ok(commands.some((command) => command.includes(`${flag}=1`)));
});

function fixture(
	action: (root: string, run: (script: string) => ReturnType<typeof spawnSync>) => void
) {
	const root = mkdtempSync(join(tmpdir(), 'lawcast-gate-'));
	try {
		assert.equal(spawnSync('git', ['init', '-q'], { cwd: root, env: fixtureEnv }).status, 0);
		writeFileSync(join(root, 'source.txt'), 'baseline\n');
		assert.equal(spawnSync('git', ['add', 'source.txt'], { cwd: root, env: fixtureEnv }).status, 0);
		const bin = join(root, '.git', 'stub-bin');
		mkdirSync(bin);
		const run = (script: string) => {
			writeFileSync(
				join(bin, 'npm'),
				`#!/bin/sh\nprintf '%s\\n' "$*" > .git/npm-call\n${script}\n`,
				{ mode: 0o755 }
			);
			return spawnSync('sh', [hook], {
				cwd: root,
				env: { ...fixtureEnv, PATH: `${bin}:${fixtureEnv.PATH}` },
				encoding: 'utf8'
			});
		};
		action(root, run);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test('blocks the commit gate when any Playwright command fails', () =>
	fixture((root, run) => {
		const result = run('exit 42');
		assert.equal(result.status, 1);
		assert.match(String(result.stderr), /Commit blocked: fix/);
		assert.equal(readFileSync(join(root, '.git/npm-call'), 'utf8').trim(), 'run test:e2e:all');
	}));

test('accepts only a successful complete matrix on unchanged staged source', () =>
	fixture((_root, run) => {
		assert.equal(run('exit 0').status, 0);
	}));

test('blocks unstaged source without running Playwright', () =>
	fixture((root, run) => {
		writeFileSync(join(root, 'source.txt'), 'unstaged\n');
		assert.equal(run('exit 0').status, 1);
		assert.equal(existsSync(join(root, '.git/npm-call')), false);
	}));

test('blocks untracked source without running Playwright', () =>
	fixture((root, run) => {
		writeFileSync(join(root, 'untracked.ts'), 'export {};\n');
		assert.equal(run('exit 0').status, 1);
		assert.equal(existsSync(join(root, '.git/npm-call')), false);
	}));

test('invalidates a passing run when the staged source changes during tests', () =>
	fixture((_root, run) => {
		const result = run("printf 'changed\\n' > source.txt\ngit add source.txt\nexit 0");
		assert.equal(result.status, 1);
		assert.match(String(result.stderr), /staged source changed/);
	}));

test('invalidates a passing run when unstaged source changes during tests', () =>
	fixture((_root, run) => {
		assert.equal(run("printf 'changed\\n' > source.txt\nexit 0").status, 1);
	}));

test('Git rejects a signed commit attempt when the installed hook sees a failing suite', () =>
	fixture((root, run) => {
		run('exit 42');
		const result = spawnSync(
			'git',
			[
				'-c',
				`core.hooksPath=${resolve('.githooks')}`,
				'-c',
				'user.name=Gate fixture',
				'-c',
				'user.email=gate@example.invalid',
				'commit',
				'-S',
				'-m',
				'test: reject a failing Playwright matrix'
			],
			{
				cwd: root,
				env: { ...fixtureEnv, PATH: `${join(root, '.git/stub-bin')}:${fixtureEnv.PATH}` },
				encoding: 'utf8'
			}
		);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Commit blocked: fix/);
		assert.notEqual(
			spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, env: fixtureEnv }).status,
			0
		);
	}));

test('keeps fixture UI coverage in the mock runner and owns real API checks in integration', () => {
	const integration = readFileSync('playwright-configs/playwright.config.integration.ts', 'utf8');
	const generic = readFileSync('playwright-configs/playwright.config.ts', 'utf8');
	assert.match(integration, /testMatch: 'backend-integration\.spec\.ts'/);
	assert.match(integration, /DIFFCHAIN_UI_MOCK: '0'/);
	assert.match(integration, /PLAYWRIGHT_BACKEND_URL/);
	assert.ok(generic.includes("'backend-integration.spec.ts'"));
	assert.ok(generic.includes("'proxy-encoding.spec.ts'"));
	for (const config of ['consumers', 'framework-cloudflare'])
		assert.ok(
			readFileSync(`playwright-configs/playwright.${config}.config.ts`, 'utf8').includes(
				"'proxy-encoding.spec.ts'"
			)
		);
	for (const name of [
		'a11y-fixes.spec.ts',
		'discussion-comment-design.spec.ts',
		'readability-actions.spec.ts'
	]) {
		assert.ok(!generic.includes(name));
	}
});

test('uses a static readiness probe when the rate-limit fixture intentionally has no upstream', () => {
	const source = readFileSync('playwright-configs/playwright.rate-limit.config.ts', 'utf8');
	assert.ok(source.includes('url: `${baseURL}/offline.html`'));
	assert.ok(source.includes("API_BASE_URL: 'http://127.0.0.1:1/api'"));
	assert.ok(source.includes("'/api/notices/keywords:90'"));
	assert.ok(source.includes("'/api/announcements/top:90'"));
	assert.ok(source.includes("DIFFCHAIN_UI_MOCK: '0'"));
	assert.ok(existsSync('static/offline.html'));
});

test('writes default theme reports into ignored output rather than the config source directory', () => {
	const source = readFileSync('playwright-configs/playwright.theme-states.config.ts', 'utf8');
	assert.ok(source.includes("new URL('../test-results/theme-states.json', import.meta.url)"));
	assert.match(
		manifest.scripts['test:e2e:all'],
		/env -u THEME_REPORT_PATH DIFFCHAIN_UI_MOCK=1 playwright test/
	);
	assert.ok(readFileSync('.gitignore', 'utf8').includes('/test-results/'));
});
