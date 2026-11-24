import { clientIp } from '../../../../src/astro.ts';

export const onRequest = clientIp();
