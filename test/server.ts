import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { type AddressInfo, createServer, type Server } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';

// The tests send to their servers from this machine's own address, which stands in for the ingress: it is a proxy
// too. What the proxies in front of an app would have written, the tests write in X-Forwarded-For themselves.

// What a build or a server of a fixture runs with. Neither Astro nor Next reports home about it.
const ENV = {
	PATH: process.env.PATH,
	NODE_ENV: 'production',
	ASTRO_TELEMETRY_DISABLED: '1',
	NEXT_TELEMETRY_DISABLED: '1',
} as const;

/** Where a server started in a test answers, once it does */
export const urlOf = async (server: Server) => {
	if (!server.listening) await once(server, 'listening');
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

/** Runs a script of a framework to its end, as its build. The output is in the error when it fails */
export const run = async (script: string, args: string[], env: Record<string, string> = {}) => {
	await promisify(execFile)(process.execPath, [script, ...args], { env: { ...ENV, ...env } });
};

/**
 * Starts a script as a server in a process of its own, on a free port it is given as PORT, and waits until it
 * answers. Gives where it answers, and what stops it.
 */
export const start = async (script: string, args: string[] = []) => {
	// A port that is free now: found by listening on it, and letting it go
	const finder = createServer().listen(0, '127.0.0.1');
	const url = await urlOf(finder);
	finder.close();
	await once(finder, 'close');

	const child = spawn(process.execPath, [script, ...args], {
		env: { ...ENV, PORT: new URL(url).port },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let output = '';
	child.stdout.on('data', (chunk) => (output += chunk));
	child.stderr.on('data', (chunk) => (output += chunk));
	const stop = () => child.kill('SIGKILL');

	// One try at a time, until one gets through or the wait is over
	const waited = new AbortController();
	const answers = async () => {
		while (!waited.signal.aborted) {
			try {
				// oxlint-disable-next-line no-await-in-loop
				await fetch(url);
				return;
			} catch {
				// oxlint-disable-next-line no-await-in-loop
				await sleep(50);
			}
		}
	};

	try {
		await Promise.race([
			answers(),
			once(child, 'exit').then(() => Promise.reject(new Error(`The server exited before it answered:\n${output}`))),
			// Not a timer to keep the tests from ending
			sleep(30_000, undefined, { ref: false }).then(() =>
				Promise.reject(new Error(`The server didn't answer in 30 s:\n${output}`))
			),
		]);
	} catch (error) {
		stop();
		throw error;
	} finally {
		waited.abort();
	}

	return { url, stop };
};
