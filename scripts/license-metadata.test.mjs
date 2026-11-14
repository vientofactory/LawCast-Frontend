import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const routePath =
	process.env.LICENSE_ROUTE ?? new URL('../src/routes/license/+page.server.ts', import.meta.url);
const source = ts.transpileModule(readFileSync(routePath, 'utf8'), {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 }
}).outputText;
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

async function loadPackages(manifest, lockfile) {
	const exports = {};
	runInNewContext(source, {
		exports,
		require(id) {
			if (id.endsWith('/package.json')) return manifest;
			if (id.endsWith('/package-lock.json')) return lockfile;
			if (id === '#lib/server/response-cache.ts') return { markResponseFailure() {} };
			throw new Error(`Unexpected import: ${id}`);
		}
	});
	const result = await exports.load({
		fetch: async () => ({ ok: true, json: async () => ({ data: [] }) }),
		locals: {}
	});
	return JSON.parse(JSON.stringify(result.frontendPackages));
}

test('reads the vendored HarfBuzz version and license from the real lockfile', async () => {
	const packages = await loadPackages(pkg, lock);
	const entry = packages.find(({ name }) => name === 'harfbuzzjs');
	assert.deepEqual(entry, { name: 'harfbuzzjs', version: '0.10.0-lawcast.1', license: 'MIT' });
	assert.deepEqual(
		packages.find(({ name }) => name === 'harfbuzz-upstream'),
		{
			name: 'harfbuzz-upstream',
			version: '0.10.0',
			license: 'MIT'
		}
	);
});

test('follows linked metadata while retaining the dependency alias', async () => {
	const packages = await loadPackages(
		{ dependencies: { alias: 'file:vendor/local' } },
		{
			packages: {
				'node_modules/alias': { link: true, resolved: 'vendor/local' },
				'vendor/local': { name: '@local/package', version: '1.2.3', license: '(MIT OR Apache-2.0)' }
			}
		}
	);
	assert.deepEqual(packages, [{ name: 'alias', version: '1.2.3', license: 'MIT OR Apache-2.0' }]);
});

test('preserves registry metadata and package notes', async () => {
	const name = '@fontsource/pretendard';
	assert.deepEqual(
		await loadPackages(
			{ dependencies: { [name]: '^1.0.0' } },
			{
				packages: {
					[`node_modules/${name}`]: {
						version: '1.0.1',
						license: 'OFL-1.1',
						resolved: 'https://registry.example/package.tgz'
					}
				}
			}
		),
		[{ name, version: '1.0.1', license: 'OFL-1.1', note: '폰트 라이선스' }]
	);
});

test('handles missing metadata and broken or circular links without hanging', async () => {
	for (const packages of [
		{},
		{ 'node_modules/local': { link: true } },
		{ 'node_modules/local': { link: true, resolved: 'vendor/missing' } },
		{ 'node_modules/local': { link: true, resolved: 'node_modules/local' } },
		{
			'node_modules/local': { link: true, resolved: 'vendor/local' },
			'vendor/local': { link: true, resolved: 'node_modules/local' }
		}
	]) {
		assert.deepEqual(
			await loadPackages({ dependencies: { local: 'file:vendor/local' } }, { packages }),
			[{ name: 'local', version: 'file:vendor/local', license: 'Unknown' }]
		);
	}
	assert.deepEqual(await loadPackages({}, {}), []);
});
