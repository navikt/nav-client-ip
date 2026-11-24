import type { IncomingHttpHeaders } from 'node:http';
import { resolveClientIp } from './index.ts';

// A Node request, as far as this reads it: http.IncomingMessage, and so NextApiRequest and Express' Request
type NodeRequest = { socket: { remoteAddress?: string }; headers: IncomingHttpHeaders };

// Headers from `next/headers`, or the headers of a Request
type RequestHeaders = { get(name: string): string | null };

/**
 * The header `setClientIpHeader()` sets. Read it only in an app whose custom server calls that for every request:
 * in any other app, it is the client's to write.
 */
export const CLIENT_IP_HEADER = 'x-nav-client-ip';

// Stands in for the peer where Next doesn't say who it is: a proxy, as the ingress is
const A_PROXY = '127.0.0.1';

/**
 * The client's IP address, or undefined when it can't be known. For where Next hands over the Node request: the
 * Pages Router's `getServerSideProps` and API routes, and a custom server.
 *
 * @example
 * `export const getServerSideProps = async ({ req }) => ({ props: { ip: clientIp(req) ?? null } })`
 */
export const clientIp = (req: NodeRequest): string | undefined =>
	resolveClientIp(req.socket.remoteAddress, req.headers['x-forwarded-for']);

/**
 * The client's IP address, or undefined when it can't be known. For where Next hands over nothing but headers: the App
 * Router's server components, route handlers and `proxy.ts`.
 *
 * The socket address isn't among them, so the peer is taken to be a proxy. That holds on Nais, where nothing reaches
 * the app except through the ingress. An app that can be reached in other ways has to resolve the address in a custom
 * server, with `setClientIpHeader()`.
 *
 * @example
 * `clientIpFromHeaders(await headers())`
 */
export const clientIpFromHeaders = (headers: RequestHeaders): string | undefined => {
	// Next puts the socket address here when a request comes without the header, so it is only missing outside Next
	const forwardedFor = headers.get('x-forwarded-for');
	return forwardedFor ? resolveClientIp(A_PROXY, forwardedFor) : undefined;
};

/**
 * Resolves the client's IP address in a custom server, where the socket is, and sets it on the request as
 * `x-nav-client-ip` for the App Router to read. Gives the address back.
 *
 * A copy of the header that the client sent is removed first, also when the address can't be known. Call it for
 * every request, before Next's handler.
 *
 * @example
 * ```ts
 * createServer((req, res) => {
 * 	setClientIpHeader(req);
 * 	return handle(req, res);
 * });
 *
 * // In the App Router
 * (await headers()).get(CLIENT_IP_HEADER);
 * ```
 */
export const setClientIpHeader = (req: NodeRequest): string | undefined => {
	delete req.headers[CLIENT_IP_HEADER];
	const ip = clientIp(req);
	if (ip) req.headers[CLIENT_IP_HEADER] = ip;
	return ip;
};
