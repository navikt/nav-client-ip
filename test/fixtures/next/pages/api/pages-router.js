import { clientIp } from '../../../../../src/next.ts';

// The Pages Router hands over the Node request, with its socket
export default function handler(req, res) {
	res.json({
		clientIp: clientIp(req) ?? null,
		socket: req.socket.remoteAddress,
		forwardedFor: req.headers['x-forwarded-for'] ?? null,
	});
}
