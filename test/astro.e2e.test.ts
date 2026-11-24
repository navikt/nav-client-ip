// node:test's test() returns a promise the runner tracks itself
/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, type RequestListener, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { run, urlOf } from './server.ts';

// fixtures/astro is an app with the middleware, built by Astro itself and served by @astrojs/node. This tests Astro
// as much as the package: what Astro.clientAddress is has changed with Astro's security fixes, and the middleware is
// written around what it is now. When a test here fails after an upgrade of Astro, read src/astro.ts again.

const ASTRO = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const FIXTURE = new URL('./fixtures/astro/', import.meta.url);

const SPOOFED = '1.2.3.4, 92.221.72.61, 35.191.103.54';

type Build = { name: string; env: Record<string, string>; dist: URL; clientAddress: string };

const BUILDS: Build[] = [
	{
		name: 'as it is',
		env: {},
		dist: new URL('./dist/plain/', FIXTURE),
		// The peer, which is the test
		clientAddress: '127.0.0.1',
	},
	{
		name: 'with security.allowedDomains set',
		env: { ALLOWED_DOMAINS: 'true' },
		dist: new URL('./dist/allowed-domains/', FIXTURE),
		// What the client wrote
		clientAddress: '1.2.3.4',
	},
];

for (const { name, env, dist, clientAddress } of BUILDS) {
	describe(`an Astro app ${name}`, () => {
		let server: Server;

		before(async () => {
			await run(ASTRO, ['build', '--root', fileURLToPath(FIXTURE)], env);
			const { handler } = (await import(new URL('./server/entry.mjs', dist).href)) as { handler: RequestListener };
			server = createServer(handler).listen(0, '127.0.0.1');
		});

		after(() => server.close());

		const get = async (headers: Record<string, string> = {}) => {
			const response = await fetch(`${await urlOf(server)}/ip`, { headers });
			return (await response.json()) as { clientIp: string | null; clientAddress: string };
		};

		test('Astro.locals.clientIp is the client the load balancer wrote, and not what the client wrote', async () => {
			assert.equal((await get({ 'x-forwarded-for': SPOOFED })).clientIp, '92.221.72.61');
		});

		test(`Astro.clientAddress is ${clientAddress} for that request`, async () => {
			assert.equal((await get({ 'x-forwarded-for': SPOOFED })).clientAddress, clientAddress);
		});

		test('Astro.locals.clientIp is the peer when there are no proxies', async () => {
			assert.equal((await get()).clientIp, '127.0.0.1');
		});

		test('Astro.locals.clientIp is unset when what the proxies point to is not an address', async () => {
			assert.equal((await get({ 'x-forwarded-for': 'not-an-ip, 35.191.0.1' })).clientIp, null);
		});

		test('a prerendered page is built, with no client', async () => {
			const html = await readFile(new URL('./client/prerendered/index.html', dist), 'utf-8');

			assert.match(html, /<p>No client<\/p>/);
		});
	});
}
