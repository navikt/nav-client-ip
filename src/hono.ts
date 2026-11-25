import { resolveClientIp } from './index.ts';

export type ClientIpVariables = {
	/** The client's IP address, or undefined when it can't resolved */
	clientIp?: string;
};

// Used with Hono adapters like node-server or vite-dev-server
type NodeBindings = { incoming?: { socket?: { remoteAddress?: string } } };

// What the middleware reads of Hono's Context, so the package needs no import of Hono and no peer dependency on it.
// `var` is never read: it is there so an app whose Variables give clientIp another type, or leave it out, gets a
// type error at `app.use(clientIp())` instead of a c.var.clientIp it can't read.
type HonoContext = {
	env?: unknown;
	req: { header(name: string): string | undefined };
	readonly var: Readonly<ClientIpVariables>;
	set: (key: 'clientIp', value: string | undefined) => void;
};

/**
 * Sets `c.var.clientIp` to the client's IP address
 *
 * This will be undefined when contacted via `app.request` - e.g. in a test.
 *
 * The app's Variables need `ClientIpVariables` for `c.var.clientIp` to have a type.
 *
 * @example
 * `new Hono<{ Variables: ClientIpVariables }>().use(clientIp())`
 */
export const clientIp = () => async (c: HonoContext, next: () => Promise<void>) => {
	const { incoming } = (c.env ?? {}) as NodeBindings;
	c.set('clientIp', resolveClientIp(incoming?.socket?.remoteAddress, c.req.header('x-forwarded-for')));
	await next();
};
