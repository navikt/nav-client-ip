// What each framework hands an app is what its addon takes, and what the addon gives has a type where the app reads
// it. Nothing here runs: tsc checks it, in `pnpm lint`.
import type { IncomingMessage } from 'node:http';
import type { APIContext, MiddlewareHandler } from 'astro';
import type { Request as ExpressRequest } from 'express';
import { Hono } from 'hono';
import type { GetServerSidePropsContext, NextApiRequest } from 'next';
import type { NextRequest } from 'next/server.js';
import { clientIp as astroClientIp } from '../src/astro.ts';
import { type ClientIpVariables, clientIp as honoClientIp } from '../src/hono.ts';
import { CLIENT_IP_HEADER, clientIp, clientIpFromHeaders, setClientIpHeader } from '../src/next.ts';

// What `await headers()` gives in the App Router
type NextHeaders = Awaited<ReturnType<typeof import('next/headers.js').headers>>;

export const astro = {
	onRequest: astroClientIp() satisfies MiddlewareHandler,
	// Astro.locals.clientIp has a type in an app that imports the middleware
	locals: ({ locals }: APIContext): string | undefined => locals.clientIp,
};

export const hono = {
	// Hono's types aren't imported by the middleware, so these say what it fits
	plain: new Hono().use(honoClientIp()),
	withOtherVariables: new Hono<{ Variables: ClientIpVariables & { user: string } }>().use(honoClientIp()),
	withBindings: new Hono<{ Bindings: { incoming: unknown } }>().use(honoClientIp()),
	readsClientIp: new Hono<{ Variables: ClientIpVariables }>()
		.use(honoClientIp())
		.get('/', (c) => c.text((c.var.clientIp satisfies string | undefined) ?? 'Unknown')),
	// @ts-expect-error -- clientIp is a string, not what the app says
	wrongType: new Hono<{ Variables: { clientIp: number } }>().use(honoClientIp()),
	// @ts-expect-error -- the app's Variables leave clientIp out, so c.var.clientIp couldn't be read
	leftOut: new Hono<{ Variables: { user: string } }>().use(honoClientIp()),
};

export const next = {
	apiRoute: (req: NextApiRequest) => clientIp(req),
	getServerSideProps: ({ req }: GetServerSidePropsContext) => clientIp(req),
	serverComponent: (headers: NextHeaders) => clientIpFromHeaders(headers),
	routeHandler: (request: Request) => clientIpFromHeaders(request.headers),
	proxy: (request: NextRequest) => clientIpFromHeaders(request.headers),
	customServer: (req: IncomingMessage) => setClientIpHeader(req),
	customServerOnExpress: (req: ExpressRequest) => setClientIpHeader(req),
	fromCustomServer: (headers: NextHeaders): string | null => headers.get(CLIENT_IP_HEADER),
};
