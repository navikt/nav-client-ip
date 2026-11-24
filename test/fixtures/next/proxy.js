import { NextResponse } from 'next/server';
import { clientIpFromHeaders } from '../../../src/next.ts';

// Tells the test what proxy.js made of each request, in a header of the response
export const proxy = (request) => {
	const response = NextResponse.next();
	response.headers.set('x-client-ip-in-proxy', clientIpFromHeaders(request.headers) ?? 'unknown');
	return response;
};
