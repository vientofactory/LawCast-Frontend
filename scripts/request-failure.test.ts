import test from 'node:test';
import assert from 'node:assert/strict';
import {
	getFailureKind,
	isServerUnavailable,
	getFailureStatus,
	getFailureRetryAfter,
	parseRetryAfter
} from '../src/lib/utils/request-failure.ts';
test('only explicit HTTP 429 is a rate limit', () => {
	for (const value of [
		{ retryAfter: 60 },
		{ kind: 'rate-limit' },
		new Error('429'),
		{ status: 503, retryAfter: 60 },
		{ status: '429' }
	])
		assert.notEqual(getFailureKind(value), 'rate-limit');
	assert.equal(getFailureKind({ status: 429, kind: 'invalid-response' }), 'rate-limit');
});
test('classifies status and transport failures without guessing from retry headers', () => {
	for (const [status, kind] of [
		[401, 'unauthorized'],
		[403, 'forbidden'],
		[404, 'not-found'],
		[422, 'invalid-request'],
		[408, 'timeout'],
		[504, 'timeout'],
		[502, 'server'],
		[503, 'server'],
		[200, 'invalid-response']
	])
		assert.equal(getFailureKind({ status, retryAfter: 60 }), kind);
	assert.equal(getFailureKind(new TypeError('fetch failed')), 'network');
	assert.equal(getFailureKind({ name: 'TimeoutError' }), 'timeout');
	assert.equal(getFailureKind({ kind: 'timeout', message: 'normalized' }), 'timeout');
	assert.equal(getFailureKind({ cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }), 'timeout');
	for (const status of [NaN, Infinity, 0, -1, 600, 429.5, '429'])
		assert.equal(getFailureStatus({ status }), undefined);
});
test('accepts valid delay seconds and HTTP dates but rejects malformed headers', () => {
	const now = Date.parse('Fri, 06 Nov 2026 00:00:00 GMT');
	assert.equal(parseRetryAfter('Fri, 06 Nov 2026 00:00:10 GMT', now), 10);
	assert.equal(parseRetryAfter('Fri, 06 Nov 2026 00:00:00 GMT', now), 0);
	assert.equal(parseRetryAfter(' 12 '), 12);
	assert.equal(parseRetryAfter('0'), 0);
	for (const value of [null, '', '5seconds', '-1', 'Infinity', '1.5', '10junk'])
		assert.equal(parseRetryAfter(value), undefined);
	assert.equal(getFailureRetryAfter({ status: 429, retryAfter: 0 }), 0);
	assert.equal(getFailureRetryAfter({ status: 429 }), 60);
	assert.equal(getFailureRetryAfter({ status: 503, retryAfter: 60 }), 0);
	assert.equal(getFailureRetryAfter({ status: 429, retryAfter: Infinity }), 60);
});

test('only connection failure without an HTTP response uses the offline screen', () => {
	for (const error of [{ kind: 'network' }, new TypeError('Failed to fetch')])
		assert.equal(isServerUnavailable(error), true);
	for (const status of [200, 400, 401, 403, 404, 408, 429, 500, 502, 503, 504]) {
		assert.equal(isServerUnavailable({ status }), false);
		assert.equal(isServerUnavailable({ status, kind: 'network' }), false);
	}
	assert.equal(isServerUnavailable(new TypeError('Load failed')), true);
	assert.equal(isServerUnavailable({ cause: { code: 'ECONNREFUSED' } }), true);
	assert.equal(isServerUnavailable({ kind: 'timeout' }), false);
	assert.equal(isServerUnavailable(new TypeError('Cannot read properties of undefined')), false);
	assert.equal(isServerUnavailable({ retryAfter: 60 }), false);
});
