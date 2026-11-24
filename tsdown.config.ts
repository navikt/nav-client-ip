import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/astro.ts', 'src/express.ts', 'src/hono.ts', 'src/next.ts'],
	platform: 'node',
	format: 'esm',
	dts: true,
});
