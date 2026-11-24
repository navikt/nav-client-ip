import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// test/astro.e2e.test.ts builds this twice: as it is, and with security.allowedDomains set to the host the tests
// send to, which changes what Astro.clientAddress is
const allowedDomains = process.env.ALLOWED_DOMAINS ? [{ hostname: '127.0.0.1' }] : [];

export default defineConfig({
	output: 'server',
	// The handler is exported, for the test to put in a server of its own
	adapter: node({ mode: 'middleware' }),
	security: { allowedDomains },
	outDir: process.env.ALLOWED_DOMAINS ? './dist/allowed-domains' : './dist/plain',
});
