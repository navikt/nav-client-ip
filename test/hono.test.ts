// node:test's test() returns a promise the runner tracks itself
/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { type ClientIpVariables, clientIp } from '../src/hono.ts';
import { CHAINS, DIRECT, headersOf } from './chains.ts';
import { urlOf } from './server.ts';

// c.var.clientIp has its type from ClientIpVariables, whether the app is made in one go
const app = new Hono<{ Variables: ClientIpVariables }>()
	.use(clientIp())
	.get('/', (c) => c.json({ ip: c.var.clientIp ?? null }));

// Or not
const typed = new Hono<{ Variables: ClientIpVariables }>();
typed.use(clientIp());
typed.get('/', (c) => c.json({ ip: c.var.clientIp ?? null }));

const ipFrom = async (response: Response | Promise<Response>) =>
	((await (await response).json()) as { ip: unknown }).ip;

// What @hono/node-server hands the app, as far as the middleware reads it. The socket can then be any address,
// where a request sent from here only ever comes from this machine.
const bindingsOf = (socket: string) => ({ incoming: { socket: { remoteAddress: socket } } });

describe('c.var.clientIp', () => {
	for (const chain of [...CHAINS, ...DIRECT]) {
		test(chain.name, async () => {
			const response = app.request('/', { headers: headersOf(chain) }, bindingsOf(chain.socket));

			assert.equal(await ipFrom(response), chain.client ?? null);
		});
	}

	test('is undefined when the app is called without a socket, as in a test of an app', async () => {
		assert.equal(await ipFrom(app.request('/', { headers: { 'x-forwarded-for': '92.221.72.61' } })), null);
		assert.equal(await ipFrom(typed.request('/')), null);
	});
});

describe('an app served by @hono/node-server', () => {
	const served = new Hono<{ Variables: ClientIpVariables }>()
		.use(clientIp())
		.get('/', (c) => c.json({ ip: c.var.clientIp ?? null, peer: getConnInfo(c).remote.address }));

	const server = serve({ fetch: served.fetch, port: 0, hostname: '127.0.0.1' });
	after(() => server.close());

	const get = async (headers: Record<string, string> = {}) => {
		const response = await fetch(await urlOf(server), { headers });
		return (await response.json()) as { ip: string | null; peer: string };
	};

	test("gives the client the load balancer wrote, where Hono's own getConnInfo() gives the peer", async () => {
		const { ip, peer } = await get({ 'x-forwarded-for': '1.2.3.4, 92.221.72.61, 35.191.103.54' });

		assert.equal(ip, '92.221.72.61');
		assert.equal(peer, '127.0.0.1');
	});

	test('gives the peer when there are no proxies', async () => {
		assert.equal((await get()).ip, '127.0.0.1');
	});
});
