# nav-client-ip

A helper module to get client IP addresses for Node apps in Nais, because it's kinda bonkers.

## Install

```
pnpm add @navikt/nav-client-ip
```

## Use

### Express

```ts
import { trustProxy } from '@navikt/nav-client-ip/express';
import express from 'express';

const app = express();

// Add this before anything that reads req.ip
app.set('trust proxy', trustProxy);

app.get('/', (req, res) => {
	res.send(req.ip);
});
```

### Hono

```ts
import { type ClientIpVariables, clientIp } from '@navikt/nav-client-ip/hono';
import { Hono } from 'hono';

const app = new Hono<{ Variables: ClientIpVariables }>();

app.use(clientIp());
app.get('/', (c) => c.text(c.var.clientIp ?? 'Unknown'));
```

### Astro

```ts
// src/middleware.ts
import { clientIp } from '@navikt/nav-client-ip/astro';

export const onRequest = clientIp();
```

```astro
---
const { clientIp } = Astro.locals;
---
```

### Next.js

```ts
// pages/api/feedback.ts
// For the Pages router
import { clientIp } from '@navikt/nav-client-ip/next';
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	res.json({ ip: clientIp(req) ?? null });
}
```

```ts
// app/api/feedback/route.ts
// For the App router
import { clientIpFromHeaders } from '@navikt/nav-client-ip/next';
import { headers } from 'next/headers';

export const POST = async () => Response.json({ ip: clientIpFromHeaders(await headers()) ?? null });
```

```ts
// server.ts
// For a custom server
import { createServer } from 'node:http';
import { setClientIpHeader } from '@navikt/nav-client-ip/next';
import next from 'next';

const app = next({ dev: false });
const handle = app.getRequestHandler();
await app.prepare();

createServer((req, res) => {
	setClientIpHeader(req);
	return handle(req, res);
}).listen(3000);
```

```ts
// app/api/feedback/route.ts, behind the custom server
import { CLIENT_IP_HEADER } from '@navikt/nav-client-ip/next';
import { headers } from 'next/headers';

export const POST = async () => Response.json({ ip: (await headers()).get(CLIENT_IP_HEADER) });
```

### Anything else

```ts
import { createServer } from 'node:http';
import { resolveClientIp } from '@navikt/nav-client-ip';

createServer((req, res) => {
	res.end(resolveClientIp(req.socket.remoteAddress, req.headers['x-forwarded-for']) ?? 'Unknown');
}).listen(3000);
```

## What this module handles

| Socket               | X-Forwarded-For                       | Client            |                                                         |
| -------------------- | ------------------------------------- | ----------------- | ------------------------------------------------------- |
| `::ffff:10.7.87.160` | `92.221.72.61, 35.191.103.54`         | `92.221.72.61`    | Google's load balancer                                  |
| `::ffff:10.7.87.160` | `1.2.3.4, 203.0.113.8, 35.191.89.191` | `203.0.113.8`     | Client-specified IPs (spoofing) is ignored              |
| `::ffff:10.7.87.160` | `192.168.251.254, 35.191.146.97`      | `192.168.251.254` | When BigIP doesn't resolve a client IP, it sets its own |
| `10.7.90.12`         |                                       | `10.7.90.12`      | If another pod called the app                           |
| `::ffff:10.7.87.160` | `not-an-ip, 35.191.0.1`               | `undefined`       | If proxies do something weird                           |
| `203.0.113.5`        | `198.51.100.1`                        | `203.0.113.5`     | No proxy                                                |

## Before limiting or blocking

```ts
import { isTrustedProxy } from '@navikt/nav-client-ip';

// undefined is a client nobody knows. A proxy's address is everyone behind that proxy
if (ip && !isTrustedProxy(ip)) {
	rateLimit(ip);
}
```

- A client behind the BigIP can come out as the BigIP, `192.168.251.254`, or as an address it wrote itself: the
  BigIP is in a private range, which is trusted, so resolving goes on into what the client sent. Don't let the
  address alone decide who gets in, and count limiting and blocking by it as best effort.
- The App Router never has the socket address, and Astro doesn't always. Where it is missing, the request is taken to
  have come through the ingress, which on Nais it has. An app that can be reached in other ways needs the socket: a
  custom server for Next, and for Astro the adapter's `middleware` mode with the address resolved in your own server.
- The address is personal data. Log it where it is needed, and no longer than that.

## Validate in prod

If your app isn't on GCP, this module might not work correctly!

Tell your best AI buddy to log and check what happens.

Note that dev and prod are wired differently, so you can't rely on dev behavior.

```ts
logger.warn('Blocked request', {
	ip,
	// Temporary: take these out when the chain is checked
	debugForwardedFor: req.headers['x-forwarded-for'],
	debugSocket: req.socket.remoteAddress,
});
```

- `debugSocket`, and every address to the right of the client in `debugForwardedFor`, is a proxy to
  `isTrustedProxy()`. One that isn't comes out as `ip` on every request, and its range is missing from this package.
- `ip` is next to never a proxy's address, and there are many different ones.

## Develop

```
pnpm test
pnpm lint
pnpm format
pnpm build
```

## Release

```diff
 	"name": "@navikt/nav-client-ip",
-	"version": "1.0.0",
+	"version": "1.0.1",
```
