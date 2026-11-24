import type { MiddlewareHandler } from 'astro';
import { resolveClientIp } from './index.ts';

declare global {
	namespace App {
		interface Locals {
			/** The client's IP address, or undefined when it can't resolved. */
			clientIp?: string;
		}
	}
}

// Stands in for the peer where Astro doesn't resolve
const A_PROXY = '127.0.0.1';

/**
 * Sets `Astro.locals.clientIp` to the client's IP address, for an app served by `@astrojs/node`.
 *
 * `Astro.clientAddress` is not that address. It is the socket address, which on Nais is the ingress. Or it is the
 * leftmost entry of X-Forwarded-For, which the client can set: always in Astro 5, and with
 * `security.allowedDomains` set from Astro 6.
 *
 * In the second case Astro doesn't say who the peer is, and it is taken to be a proxy. That holds on Nais, where
 * nothing reaches the app except through the ingress. An app that can be reached in other ways has to run the
 * adapter in `middleware` mode and resolve the address in its own server, where the socket is.
 *
 * A prerendered page is built without a client, and its `clientIp` is left unset.
 *
 * @example
 * `export const onRequest = clientIp()`
 */
export const clientIp = (): MiddlewareHandler => (context, next) => {
	if (!context.isPrerendered) {
		const forwardedFor = context.request.headers.get('x-forwarded-for');
		const leftmost = forwardedFor?.split(',')[0]?.trim();
		// Astro can be goofy
		const peer = context.clientAddress === leftmost ? A_PROXY : context.clientAddress;
		context.locals.clientIp = resolveClientIp(peer, forwardedFor);
	}
	return next();
};
