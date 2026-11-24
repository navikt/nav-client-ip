// node:test's test() returns a promise the runner tracks itself
/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CLIENT_IP_HEADER } from '../src/next.ts';
import { run, start } from './server.ts';

// fixtures/next is an app with both routers and a proxy.js, built by Next itself. It is served by `next start` and
// by a custom server, each a process of its own. This tests Next as much as the package: what Next does with
// X-Forwarded-For is what src/next.ts is written around. When a test here fails after an upgrade of Next, read
// src/next.ts again.

const NEXT = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/next/', import.meta.url));

const SPOOFED = '1.2.3.4, 92.221.72.61, 35.191.103.54';

type AppRouter = {
	clientIp: string | null;
	clientIpOfRequest: string | null;
	fromCustomServer: string | null;
	forwardedFor: string | null;
};

const SERVERS = [
	{ name: '`next start`', script: NEXT, args: ['start', FIXTURE, '--hostname', '127.0.0.1'], custom: false },
	{ name: 'a custom server', script: `${FIXTURE}server.mjs`, args: [], custom: true },
];

describe('a Next app', () => {
	before(() => run(NEXT, ['build', FIXTURE]));

	for (const { name, script, args, custom } of SERVERS) {
		describe(`served by ${name}`, () => {
			let server: Awaited<ReturnType<typeof start>>;

			before(async () => {
				server = await start(script, args);
			});

			after(() => server.stop());

			const get = (path: string, headers: Record<string, string> = {}) => fetch(`${server.url}${path}`, { headers });

			const appRouter = async (headers?: Record<string, string>) =>
				(await (await get('/app-router', headers)).json()) as AppRouter;

			test('the Pages Router gives the client the load balancer wrote, in an API route', async () => {
				const response = await get('/api/pages-router', { 'x-forwarded-for': SPOOFED });

				assert.deepEqual(await response.json(), {
					clientIp: '92.221.72.61',
					socket: '127.0.0.1',
					forwardedFor: SPOOFED,
				});
			});

			test('and in getServerSideProps', async () => {
				const response = await get('/gssp', { 'x-forwarded-for': SPOOFED });

				assert.match(await response.text(), /<p>92\.221\.72\.61<\/p>/);
			});

			test('the App Router gives it from headers(), and from the headers of the request', async () => {
				const { clientIp, clientIpOfRequest } = await appRouter({ 'x-forwarded-for': SPOOFED });

				assert.equal(clientIp, '92.221.72.61');
				assert.equal(clientIpOfRequest, '92.221.72.61');
			});

			test('proxy.js gives it too', async () => {
				const response = await get('/app-router', { 'x-forwarded-for': SPOOFED });

				assert.equal(response.headers.get('x-client-ip-in-proxy'), '92.221.72.61');
			});

			test('Next passes on what the client wrote in X-Forwarded-For', async () => {
				assert.equal((await appRouter({ 'x-forwarded-for': SPOOFED })).forwardedFor, SPOOFED);
			});

			test('Next puts the peer in X-Forwarded-For when a request comes without it, and the peer is the client', async () => {
				const response = await get('/app-router');
				const { clientIp, forwardedFor } = (await response.json()) as AppRouter;

				assert.equal(forwardedFor, '127.0.0.1');
				assert.equal(clientIp, '127.0.0.1');
				assert.equal(response.headers.get('x-client-ip-in-proxy'), '127.0.0.1');
			});

			if (custom) {
				test('the App Router reads the client from the header of the custom server, whatever the client wrote there', async () => {
					const { fromCustomServer } = await appRouter({ 'x-forwarded-for': SPOOFED, [CLIENT_IP_HEADER]: '6.6.6.6' });

					assert.equal(fromCustomServer, '92.221.72.61');
				});

				test('and reads nothing when the client is unknown', async () => {
					const unknown = { 'x-forwarded-for': 'not-an-ip, 35.191.0.1', [CLIENT_IP_HEADER]: '6.6.6.6' };

					assert.equal((await appRouter(unknown)).fromCustomServer, null);
				});
			} else {
				test("without a custom server, that header is the client's to write: it must not be read", async () => {
					const { fromCustomServer } = await appRouter({ 'x-forwarded-for': SPOOFED, [CLIENT_IP_HEADER]: '6.6.6.6' });

					assert.equal(fromCustomServer, '6.6.6.6');
				});
			}
		});
	}
});
