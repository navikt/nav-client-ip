import { headers } from 'next/headers';
import { CLIENT_IP_HEADER, clientIpFromHeaders } from '../../../../../src/next.ts';

// The App Router hands over headers and nothing else
export const GET = async (request) => {
	const fromNext = await headers();

	return Response.json({
		clientIp: clientIpFromHeaders(fromNext) ?? null,
		clientIpOfRequest: clientIpFromHeaders(request.headers) ?? null,
		fromCustomServer: fromNext.get(CLIENT_IP_HEADER),
		forwardedFor: fromNext.get('x-forwarded-for'),
	});
};
