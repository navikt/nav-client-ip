import { isTrustedProxy } from './index.ts';

/**
 * Used with Express' trust-proxy setting.
 * - `req.ip` is then the client's address
 * `req.protocol` and `req.hostname` are based on the client request
 *
 * Express can give ugly addresses (e.g. `::ffff:10.1.2.3`), but `resolveClientIp` will tidy these.
 *
 * @example
 * `app.set('trust proxy', trustProxy)`
 */
export const trustProxy = (address: string): boolean => isTrustedProxy(address);
