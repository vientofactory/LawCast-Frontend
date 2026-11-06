import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('harfbuzz-upstream/hbjs.js'), 'utf8');
const signatures = [...new Set([...source.matchAll(/'([vifjd]+)'/g)].map(match => match[1]))].sort();
const codes = { i: 127, j: 126, f: 125, d: 124 };
for (const signature of signatures) {
  const params = [...signature.slice(1)].map(type => codes[type]);
  const results = signature[0] === 'v' ? [] : [codes[signature[0]]];
  const type = [1, 96, params.length, ...params, results.length, ...results];
  if (type.length >= 128) throw new Error('Signature needs multi-byte section sizing');
  const bytes = Uint8Array.from([
    0, 97, 115, 109, 1, 0, 0, 0,
    1, type.length, ...type,
    2, 7, 1, 1, 101, 1, 102, 0, 0,
    7, 5, 1, 1, 102, 0, 0,
  ]);
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, { e: { f: () => 0 } });
  if (typeof instance.exports.f !== 'function') throw new Error('Invalid callback bridge');
  const target = new URL(`callback-${signature}.wasm`, import.meta.url);
  const existing = readFileSync(target);
  if (Buffer.compare(existing, bytes) !== 0) throw new Error(`Bridge mismatch: ${signature}`);
  writeFileSync(target, bytes);
}
console.log(`WASM: ${signatures.length} callback bridges match upstream signatures and instantiate successfully`);
