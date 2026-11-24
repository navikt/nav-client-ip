import { createServer } from 'node:http';
import next from 'next';
import { setClientIpHeader } from '../../../src/next.ts';

// A custom server: it has the socket, and tells the App Router who the client is
const app = next({ dev: false, dir: import.meta.dirname });
const handle = app.getRequestHandler();
await app.prepare();

createServer((req, res) => {
	setClientIpHeader(req);
	return handle(req, res);
}).listen(Number(process.env.PORT), '127.0.0.1');
