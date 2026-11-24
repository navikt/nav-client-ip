import type { MiddlewareHandler } from 'hono';
import { resolveClientIp } from './index.ts';

export type ClientIpVariables = {
	/** The client's IP address, or undefined when it can't resolved */
	clientIp?: string;
};

// Used with Hono adapters like node-server or vite-dev-server
type NodeBindings = { incoming?: { socket?: { remoteAddress?: string } } };

/**
 * Sets `c.var.clientIp` to the client's IP address
 *
 * This will be undefined when contacted via `app.request` - e.g. in a test.
 *
 * @example
 * `app.use(clientIp())`
 */
export const clientIp = (): MiddlewareHandler<{ Variables: ClientIpVariables }> => async (c, next) => {
	const { incoming } = (c.env ?? {}) as NodeBindings;
	c.set('clientIp', resolveClientIp(incoming?.socket?.remoteAddress, c.req.header('x-forwarded-for')));
	await next();
};
