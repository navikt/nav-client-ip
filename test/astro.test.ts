// node:test's test() returns a promise the runner tracks itself
/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { APIContext } from 'astro';
import { clientIp } from '../src/astro.ts';
import { type Chain, CHAINS, DIRECT, headersOf } from './chains.ts';

// What Astro hands a middleware, as far as this one reads it
const contextOf = (chain: Chain, clientAddress: string) =>
	({
		isPrerendered: false,
		clientAddress,
		request: new Request('http://app.test/', { headers: headersOf(chain) }),
		locals: {},
	}) as unknown as APIContext;

// Astro.clientAddress in Astro 5, and from Astro 6 with security.allowedDomains set: the leftmost entry of
// X-Forwarded-For when there is one. test/astro.e2e.test.ts sees Astro do that.
const leftmostOrSocket = ({ socket, forwardedFor }: Chain) => forwardedFor?.split(',')[0]?.trim() || socket;

const page = new Response('The page');
const next = async () => page;

const resolved = async (context: APIContext) => {
	assert.equal(await clientIp()(context, next), page);
	return context.locals.clientIp;
};

describe('Astro.locals.clientIp, where Astro.clientAddress is the socket address', () => {
	for (const chain of [...CHAINS, ...DIRECT]) {
		test(chain.name, async () => {
			assert.equal(await resolved(contextOf(chain, chain.socket)), chain.client);
		});
	}
});

describe('Astro.locals.clientIp, where Astro.clientAddress is the leftmost entry of X-Forwarded-For', () => {
	for (const chain of CHAINS) {
		test(chain.name, async () => {
			assert.equal(await resolved(contextOf(chain, leftmostOrSocket(chain))), chain.client);
		});
	}

	const [alone, withHeader] = DIRECT as [Chain, Chain];

	test(alone.name, async () => {
		assert.equal(await resolved(contextOf(alone, leftmostOrSocket(alone))), alone.client);
	});

	test('no proxy: the header of the peer is believed, since Astro no longer says who the peer is', async () => {
		assert.equal(await resolved(contextOf(withHeader, leftmostOrSocket(withHeader))), withHeader.forwardedFor);
	});
});

describe('a prerendered page', () => {
	test('has no client, and Astro.clientAddress, which throws there, is left alone', async () => {
		const context = {
			isPrerendered: true,
			get clientAddress(): string {
				throw new Error('Astro.clientAddress is not available on prerendered pages');
			},
			request: new Request('http://app.test/'),
			locals: {},
		} as unknown as APIContext;

		assert.equal(await resolved(context), undefined);
		assert.equal('clientIp' in context.locals, false);
	});
});
