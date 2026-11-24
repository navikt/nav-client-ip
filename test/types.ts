// What each framework hands an app is what its addon takes, and what the addon gives has a type where the app reads
// it. Nothing here runs: tsc checks it, in `pnpm lint`.
import type { IncomingMessage } from 'node:http';
import type { APIContext, MiddlewareHandler } from 'astro';
import type { Request as ExpressRequest } from 'express';
import type { GetServerSidePropsContext, NextApiRequest } from 'next';
import type { NextRequest } from 'next/server.js';
import { clientIp as astroClientIp } from '../src/astro.ts';
import { CLIENT_IP_HEADER, clientIp, clientIpFromHeaders, setClientIpHeader } from '../src/next.ts';

// What `await headers()` gives in the App Router
type NextHeaders = Awaited<ReturnType<typeof import('next/headers.js').headers>>;

export const astro = {
	onRequest: astroClientIp() satisfies MiddlewareHandler,
	// Astro.locals.clientIp has a type in an app that imports the middleware
	locals: ({ locals }: APIContext): string | undefined => locals.clientIp,
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
