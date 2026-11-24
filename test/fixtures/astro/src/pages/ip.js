// What the middleware made of the request, next to what Astro itself says the client is
export const GET = ({ locals, clientAddress }) => Response.json({ clientIp: locals.clientIp ?? null, clientAddress });
