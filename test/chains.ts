// Requests as they reach an app: the address of the peer, X-Forwarded-For, and who the client then is. The resolver
// and every framework's addon are run through them, so they can't come to disagree.

export type Chain = {
	name: string;
	socket: string;
	forwardedFor?: string;
	/** undefined is a client that can't be known */
	client: string | undefined;
};

// The ingress in prod-gcp, as Node gives it: the app listens on IPv4 and IPv6 at once
const INGRESS = '::ffff:10.7.87.160';

export const CHAINS: Chain[] = [
	{
		name: 'prod-gcp: the load balancer writes the client and itself',
		socket: INGRESS,
		forwardedFor: '92.221.72.61, 35.191.103.54',
		client: '92.221.72.61',
	},
	{
		name: 'a client on IPv6',
		socket: INGRESS,
		forwardedFor: '2001:db8::1, 35.191.89.191',
		client: '2001:db8::1',
	},
	{
		name: "the load balancer's other IPv4 range",
		socket: INGRESS,
		forwardedFor: '203.0.113.7, 130.211.0.5',
		client: '203.0.113.7',
	},
	{
		name: 'the load balancer on IPv6',
		socket: INGRESS,
		forwardedFor: '203.0.113.10, 2600:2d00:1:1::5',
		client: '203.0.113.10',
	},
	{
		name: 'what the client puts in the header itself is to the left, and ignored',
		socket: INGRESS,
		forwardedFor: '1.2.3.4, 203.0.113.8, 35.191.89.191',
		client: '203.0.113.8',
	},
	{
		name: 'a client that tries with an address of the cluster',
		socket: INGRESS,
		forwardedFor: '10.0.0.1, 203.0.113.8, 35.191.89.191',
		client: '203.0.113.8',
	},
	{
		name: 'hops inside the cluster are passed',
		socket: '127.0.0.1',
		forwardedFor: '198.51.100.1, 203.0.113.3, 10.0.0.7',
		client: '203.0.113.3',
	},
	{
		name: 'a hop in the shared address space is passed',
		socket: '::1',
		forwardedFor: '203.0.113.4, 100.64.1.2',
		client: '203.0.113.4',
	},
	{
		name: "an address just outside the load balancer's range is a client",
		socket: INGRESS,
		forwardedFor: '203.0.113.7, 130.211.4.1',
		client: '130.211.4.1',
	},
	{
		name: "the load balancer's health checks come from a range of their own, which isn't trusted",
		socket: INGRESS,
		forwardedFor: '203.0.113.10, 2600:2d00:1:b029::1',
		client: '2600:2d00:1:b029::1',
	},
	{
		name: 'the BigIP found no client and wrote itself: that is all there is',
		socket: INGRESS,
		forwardedFor: '192.168.251.254, 35.191.146.97',
		client: '192.168.251.254',
	},
	{
		name: 'another pod calls the app: the pod is the client',
		socket: '10.7.90.12',
		client: '10.7.90.12',
	},
];

// Where the peer isn't a proxy, the header is the peer's own writing. Only what knows the socket address can tell.
export const DIRECT: Chain[] = [
	{
		name: 'no proxy: the peer is the client',
		socket: '203.0.113.5',
		client: '203.0.113.5',
	},
	{
		name: "no proxy: the peer's header isn't believed",
		socket: '203.0.113.5',
		forwardedFor: '198.51.100.1',
		client: '203.0.113.5',
	},
];

/** The request headers of a chain */
export const headersOf = ({ forwardedFor }: Chain): Record<string, string> =>
	forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor };
