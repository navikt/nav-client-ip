// node:test's test() returns a promise the runner tracks itself
/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isTrustedProxy, resolveClientIp } from '../src/index.ts';
import { CHAINS, DIRECT } from './chains.ts';

const INGRESS = '::ffff:10.7.87.160';

describe('resolveClientIp', () => {
	for (const { name, socket, forwardedFor, client } of [...CHAINS, ...DIRECT]) {
		test(name, () => {
			assert.equal(resolveClientIp(socket, forwardedFor), client);
		});
	}

	test('the client is unknown without a socket address, whatever the header says', () => {
		assert.equal(resolveClientIp(undefined, '92.221.72.61, 35.191.103.54'), undefined);
		assert.equal(resolveClientIp('', '92.221.72.61, 35.191.103.54'), undefined);
	});

	test('the client is unknown when what the proxies point to is not an address', () => {
		assert.equal(resolveClientIp(INGRESS, 'not-an-ip, 35.191.0.1'), undefined);
		assert.equal(resolveClientIp(INGRESS, '203.0.113.8:4711, 35.191.0.1'), undefined);
		assert.equal(resolveClientIp('not-an-ip'), undefined);
	});

	test("what isn't an address is ignored like anything else, left of the client", () => {
		assert.equal(resolveClientIp(INGRESS, '<script>, 203.0.113.8, 35.191.0.1'), '203.0.113.8');
	});

	test('an IPv4 address written as IPv6 is given as IPv4', () => {
		assert.equal(resolveClientIp('::ffff:203.0.113.5'), '203.0.113.5');
		assert.equal(resolveClientIp('::FFFF:10.7.90.12'), '10.7.90.12');
		assert.equal(resolveClientIp(INGRESS, '::ffff:203.0.113.9, 35.191.0.1'), '203.0.113.9');
	});

	test('a proxy written that way is still a proxy', () => {
		assert.equal(resolveClientIp(INGRESS, '203.0.113.9, ::ffff:10.0.0.7'), '203.0.113.9');
	});

	test('takes the header as Node and as fetch give it', () => {
		// Node, when the header came on several lines and is read as a list
		assert.equal(resolveClientIp(INGRESS, ['1.2.3.4', '203.0.113.8, 35.191.89.191']), '203.0.113.8');
		// Headers.get(), when there is no such header
		assert.equal(resolveClientIp('203.0.113.5', null), '203.0.113.5');
	});

	test('spaces and empty entries make no difference', () => {
		assert.equal(resolveClientIp(` ${INGRESS} `, ' 203.0.113.9 ,, 35.191.0.1 ,'), '203.0.113.9');
		assert.equal(resolveClientIp('203.0.113.5', ''), '203.0.113.5');
	});
});

describe('isTrustedProxy', () => {
	const PROXIES = [
		// The ingress, as Node gives it and as it is
		'::ffff:10.7.87.160',
		'10.7.87.160',
		// Nav's BigIP
		'192.168.251.254',
		// Google's load balancers
		'35.191.103.54',
		'130.211.0.5',
		'130.211.3.255',
		'2600:2d00:1:1::5',
		// A sidecar
		'127.0.0.1',
		'::1',
		// The rest of what is private, link-local or shared
		'172.16.0.1',
		'172.31.255.255',
		'fd00::1',
		'169.254.1.1',
		'fe80::1',
		'100.64.1.2',
		'100.127.255.255',
	];

	const CLIENTS = [
		'92.221.72.61',
		'2001:db8::1',
		// Next to a trusted range, not in it
		'35.192.0.1',
		'130.211.4.1',
		'172.32.0.1',
		'100.128.0.1',
		'11.0.0.1',
		// The load balancer's health check range
		'2600:2d00:1:b029::1',
		'2600:2d00:1:2::1',
		// Not addresses
		'not-an-ip',
		'10.0.0.1:8080',
		'',
	];

	for (const address of PROXIES) {
		test(`${address} is a proxy`, () => assert.equal(isTrustedProxy(address), true));
	}

	for (const address of CLIENTS) {
		test(`${address || 'nothing'} is not`, () => assert.equal(isTrustedProxy(address), false));
	}
});
