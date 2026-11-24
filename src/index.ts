import { BlockList, isIP } from 'node:net';

// Lists the possible proxies/layers between the internet and an app on Nais
// X-Forwarded-For is filtered against these
const TRUSTED_PROXIES = [
	// Loopback, where a sidecar connects from
	'127.0.0.0/8',
	'::1/128',
	// Link-local
	'169.254.0.0/16',
	'fe80::/10',
	// Private - the pods of a cluster and Nav's BigIP
	'10.0.0.0/8',
	'172.16.0.0/12',
	'192.168.0.0/16',
	'fc00::/7',
	// Shared address space (RFC 6598) - some clusters/pods
	'100.64.0.0/10',
	// Google's load balancers (GFE).
	// https://cloud.google.com/load-balancing/docs/firewall-rules
	'35.191.0.0/16',
	'130.211.0.0/22',
	'2600:2d00:1:1::/64',
];

const trusted = new BlockList();
for (const range of TRUSTED_PROXIES) {
	const [network, prefix] = range.split('/') as [string, string];
	trusted.addSubnet(network, Number(prefix), isIP(network) === 6 ? 'ipv6' : 'ipv4');
}

// Node listens on IPv4 and IPv6, then provides IPv4 peers as '::ffff:10.1.2.3' instead of 10.1.2.3.
const normalize = (address: string) => {
	const trimmed = address.trim();
	return /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed)?.[1] ?? trimmed;
};

/**
 * Whether the IP is one of the proxies instead of a client
 * BigIP and Google sometimes won't tag a request with the client's IP
 * So for rate limiting or other use-cases we expose a method to detect this
 *
 * @example
 * `if (ip && !isTrustedProxy(ip)) rateLimit(ip)`
 */
export const isTrustedProxy = (address: string): boolean => {
	const ip = normalize(address);
	const version = isIP(ip);
	return version !== 0 && trusted.check(ip, version === 6 ? 'ipv6' : 'ipv4');
};

/**
 * The client's IP address, or undefined when it can't be resolved.
 *
 * It starts at the socket address, then goes leftwards through
 * X-Forwarded-For for as long as each address is a proxy.
 *
 * @param socketAddress The address of the peer, such as `req.socket.remoteAddress`
 * @param forwardedFor The X-Forwarded-For header as the framework gives it
 *
 * @example
 * `resolveClientIp(req.socket.remoteAddress, req.headers['x-forwarded-for'])`
 */
export const resolveClientIp = (
	socketAddress: string | undefined,
	forwardedFor?: string | string[] | null
): string | undefined => {
	if (!socketAddress) return undefined;

	// Nearest the app first
	const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : (forwardedFor ?? '');
	const hops = header.split(',').map(normalize).filter(Boolean).toReversed();

	let candidate = normalize(socketAddress);
	for (const hop of hops) {
		if (!isTrustedProxy(candidate)) break;
		candidate = hop;
	}

	return isIP(candidate) === 0 ? undefined : candidate;
};
