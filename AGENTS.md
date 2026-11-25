# AGENTS.md

The rules for changing nav-client-ip. [README.md](README.md) shows how an app uses it.

## Commands

| Command       | What it does                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm test`   | `node --test` on every `test/**/*.test.ts`. A few seconds, in which it builds an Astro app and a Next app. |
| `pnpm lint`   | `oxfmt --check`, oxlint and `tsc --noEmit`. Run it before calling a change done.                           |
| `pnpm format` | oxfmt, Markdown included.                                                                                  |
| `pnpm build`  | tsdown, to `dist/`.                                                                                        |

## The proxies

`TRUSTED_PROXIES` in `src/index.ts` is what can stand between the internet and an app on Nais. Everything else in
the package follows from that list.

- A range is there because it has been seen in an app's logs, read as the README's "Check it in prod" says. The
  first chain in `test/chains.ts` is nav-enonicxp-frontend's in prod-gcp. That a range is common, or that other
  packages trust it, doesn't put it there.
- Google's ranges are the ones its load balancers' proxies connect from, "GFE proxy ranges" on
  https://cloud.google.com/load-balancing/docs/firewall-rules. The health check ranges on the same page are not
  trusted, and `2600:2d00:1:b029::/64` is in the tests as one that isn't. The list was last read against the page on
  2026-11-23. Read it again when a load balancer's address comes out as a client's.
- The private ranges are trusted whole. So a proxy with a private address, as the BigIP, sends the resolving on into
  what the client wrote. The README says what that means for an app. Don't narrow the ranges to get around it: the
  pods of a cluster can be anywhere in them.
- An app can't add ranges of its own. What its chain needs goes in the list, so every app gets it.

## How the package is put together

- `src/index.ts` is the resolver, and has no dependencies. The other entry points are what one framework needs on
  top of it, and import nothing but it and types.
- The package has no dependencies, peer ones included. GitHub Packages leaves `peerDependenciesMeta` out of its
  metadata, so an optional peer comes out required, and pnpm installs Astro in every app that installs the package.
  So the Hono and Astro entry points don't import their framework's types either: they declare what they read of
  its context themselves, and `test/types.ts` checks that it still fits. Hono and Astro are dev dependencies, for
  the tests. Express and Next need nothing: what their addons take is a function and a Node request.
- The Hono middleware's context has `var` in it, which it never reads. It makes `app.use(clientIp())` a type error
  in an app whose Variables don't have `clientIp` as `ClientIpVariables` says. Since the middleware no longer carries
  Hono's `MiddlewareHandler<{ Variables: ClientIpVariables }>`, an app made in one go doesn't get `c.var.clientIp`
  from it, and declares `ClientIpVariables` itself.
- Nothing is kept between calls, and nothing is read from the environment.
- The entry points are exported under `default`, not `import`, so that `require()` finds them too.
  nav-enonicxp-frontend's server is bundled to CommonJS with the packages left out, and loads the package that way.
  Its Jest loads it since it runs with `--experimental-vm-modules`.
- It is published compiled. Some of the apps run their TypeScript as it is, and Node doesn't strip types in files
  under `node_modules`.
- Every version in `package.json` is exact, and pnpm installs only releases at least three days old
  (`minimumReleaseAge`).

## What each addon stands on

The tests see the frameworks do these things, in the versions in `package.json`, and fail if they stop. What was
seen by hand when the package was written, and has no test, says so.

- **Express** takes a function as `trust proxy`, and asks it about the socket and then each entry from the right.
  By hand: Express 4 does the same.
- **Hono**: `@hono/node-server` hands the app the Node request as `c.env.incoming`. By hand: it has since 1.6, and
  `@hono/vite-dev-server`, which the apps run in dev, does too. Hono's own `getConnInfo()` throws where there is no
  such request, which is why the addon doesn't use it: an app's tests call `app.request()` with no socket.
- **Astro**: `Astro.clientAddress` is the socket address, or the leftmost entry of X-Forwarded-For where
  `security.allowedDomains` has the request's host. By hand: that is Astro 6 and 7, and in Astro 5 it is the
  leftmost entry whatever the config. The addon never needs to know which. It takes an address that is the same as
  the leftmost entry to say nothing about the peer, and so gave the right client in 5.0.0, 5.18.2 and 6.4.8 too.
- **Next** passes X-Forwarded-For on as it came, and puts the socket address there when a request has none. Only the
  Pages Router and a custom server get the socket. A header set on the request in a custom server reaches
  `headers()`, and so does one a client sends when there is no custom server: `CLIENT_IP_HEADER` is only for an
  app that calls `setClientIpHeader()`.

Where the socket can't be had (the App Router, and Astro when `Astro.clientAddress` is the leftmost entry) the peer
is taken to be a proxy. On Nais that is the same answer, since nothing reaches a pod from outside the trusted ranges.
Keep using the socket wherever a framework gives it.

## Tests

- Tests are in `test/`, not next to the code.
- `test/chains.ts` is requests as they reach an app, and who the client then is. The resolver and every addon are run
  through all of them, so an addon can't come to give another answer than the resolver. A new chain goes there.
- `*.e2e.test.ts` build the apps in `test/fixtures` with Astro and Next themselves, and send them requests. They test
  the frameworks as much as the package. When one fails after an upgrade, what its addon stands on may have changed:
  read the addon again, and change it and this file with the test rather than the test alone.
- `test/types.ts` is never run. `tsc` checks that what each framework hands over is what its addon takes, and that
  the Hono addon is a type error where an app's Variables disagree with it.
- The fixtures' builds and servers run with telemetry off (`test/server.ts`).
- Each test has been seen to fail with its behaviour taken out of the source. Do the same for a new one.

## README

- Its `ts` blocks type-check against the built package. Check them again when what they show changes.
- What an app needs to know to use the address safely is there. Why the package is as it is goes here or in the
  JSDoc.

## Release

A change reaches the apps when `version` in `package.json` is bumped: merging that to main publishes the version to
GitHub Packages.
