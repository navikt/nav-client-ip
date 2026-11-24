// node:test's test() returns a promise the runner tracks itself
/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CLIENT_IP_HEADER, clientIp, clientIpFromHeaders, setClientIpHeader } from '../src/next.ts';
import { type Chain, CHAINS, DIRECT, headersOf } from './chains.ts';

// The Node request of the Pages Router and of a custom server, as far as it is read
const requestOf = (chain: Chain, headers: Record<string, string> = {}) => ({
	socket: { remoteAddress: chain.socket },
	headers: { ...headersOf(chain), ...headers },
});

// The headers of the App Router. Next has put the socket address in X-Forwarded-For where a request came without the
// header, which test/next.e2e.test.ts sees it do.
const headersAsNextGivesThem = (chain: Chain) => new Headers({ 'x-forwarded-for': chain.forwardedFor ?? chain.socket });

describe('clientIp, from the Node request', () => {
	for (const chain of [...CHAINS, ...DIRECT]) {
		test(chain.name, () => {
			assert.equal(clientIp(requestOf(chain)), chain.client);
		});
	}
});

describe('clientIpFromHeaders, from headers alone', () => {
	for (const chain of CHAINS) {
		test(chain.name, () => {
			assert.equal(clientIpFromHeaders(headersAsNextGivesThem(chain)), chain.client);
		});
	}

	const [alone, withHeader] = DIRECT as [Chain, Chain];

	test(alone.name, () => {
		assert.equal(clientIpFromHeaders(headersAsNextGivesThem(alone)), alone.client);
	});

	test('no proxy: the header of the peer is believed, since the peer is nowhere to be seen', () => {
		assert.equal(clientIpFromHeaders(headersAsNextGivesThem(withHeader)), withHeader.forwardedFor);
	});

	test('the client is unknown when there is nothing to go on', () => {
		assert.equal(clientIpFromHeaders(new Headers()), undefined);
		assert.equal(clientIpFromHeaders(new Headers({ 'x-forwarded-for': 'not-an-ip' })), undefined);
	});

	test('a header the client made to look like the one from a custom server is not read', () => {
		const headers = new Headers({ [CLIENT_IP_HEADER]: '1.2.3.4', 'x-forwarded-for': '92.221.72.61, 35.191.103.54' });

		assert.equal(clientIpFromHeaders(headers), '92.221.72.61');
	});
});

describe('setClientIpHeader, in a custom server', () => {
	for (const chain of [...CHAINS, ...DIRECT]) {
		test(chain.name, () => {
			const req = requestOf(chain);

			assert.equal(setClientIpHeader(req), chain.client);
			assert.equal(req.headers[CLIENT_IP_HEADER], chain.client);
		});
	}

	test('what the client sent in that header is replaced', () => {
		const req = requestOf(CHAINS[0], { [CLIENT_IP_HEADER]: '1.2.3.4' });

		setClientIpHeader(req);

		assert.equal(req.headers[CLIENT_IP_HEADER], '92.221.72.61');
	});

	test('and is removed when the client is unknown, so the App Router never reads what the client wrote', () => {
		const unknown = {
			name: 'unknown',
			socket: '10.7.87.160',
			forwardedFor: 'not-an-ip, 35.191.0.1',
			client: undefined,
		};
		const req = requestOf(unknown, { [CLIENT_IP_HEADER]: '1.2.3.4' });

		assert.equal(setClientIpHeader(req), undefined);
		assert.equal(CLIENT_IP_HEADER in req.headers, false);
	});
});
