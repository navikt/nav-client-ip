// node:test's test() returns a promise the runner tracks itself
/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import express, { type Request } from 'express';
import { trustProxy } from '../src/express.ts';
import { CHAINS, DIRECT, headersOf } from './chains.ts';
import { urlOf } from './server.ts';

const app = express();
app.set('trust proxy', trustProxy);
app.get('/', (req, res) => {
	res.json({ ip: req.ip, ips: req.ips, protocol: req.protocol, hostname: req.hostname });
});

// A request on Express' own request prototype, so what it gives is what Express makes of it when it runs. The
// socket can then be any address, where a request sent from here only ever comes from this machine.
const requestOf = (socket: string, headers: Record<string, string> = {}) =>
	Object.assign(Object.create(app.request) as Request, { app, socket: { remoteAddress: socket }, headers });

describe('req.ip, with trust proxy set to trustProxy', () => {
	for (const chain of [...CHAINS, ...DIRECT]) {
		test(chain.name, () => {
			assert.equal(requestOf(chain.socket, headersOf(chain)).ip, chain.client);
		});
	}

	test('is the address as it was written, where resolveClientIp() tidies it', () => {
		// A client that connects to the app itself, over IPv4
		assert.equal(requestOf('::ffff:203.0.113.5').ip, '::ffff:203.0.113.5');
		// What the proxies point to isn't an address
		assert.equal(requestOf('10.7.87.160', { 'x-forwarded-for': 'not-an-ip, 35.191.0.1' }).ip, 'not-an-ip');
	});
});

describe('the rest of what Express takes from the proxies', () => {
	const forwarded = { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'www.nav.no', host: 'app.internal' };

	test('is believed from a proxy', () => {
		const req = requestOf('::ffff:10.7.87.160', forwarded);

		assert.equal(req.protocol, 'https');
		assert.equal(req.hostname, 'www.nav.no');
	});

	test('is not believed from anyone else', () => {
		const req = requestOf('203.0.113.5', forwarded);

		assert.equal(req.protocol, 'http');
		assert.equal(req.hostname, 'app.internal');
	});
});

describe('a running Express app', () => {
	const server = app.listen(0, '127.0.0.1');
	after(() => server.close());

	const get = async (headers: Record<string, string>) => {
		const response = await fetch(await urlOf(server), { headers });
		return (await response.json()) as { ip: string; ips: string[]; protocol: string };
	};

	test('gives the client the load balancer wrote, and not what the client wrote', async () => {
		const { ip, ips, protocol } = await get({
			'x-forwarded-for': '1.2.3.4, 92.221.72.61, 35.191.103.54',
			'x-forwarded-proto': 'https',
		});

		assert.equal(ip, '92.221.72.61');
		assert.deepEqual(ips, ['92.221.72.61', '35.191.103.54']);
		assert.equal(protocol, 'https');
	});
});
