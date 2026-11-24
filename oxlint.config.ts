import { defineConfig } from 'oxlint';

export default defineConfig({
	plugins: ['typescript', 'unicorn', 'oxc', 'promise'],
	categories: { correctness: 'error', suspicious: 'error', perf: 'error' },
	options: { reportUnusedDisableDirectives: 'warn', typeAware: true },
	rules: {
		'no-console': 'error',
		'typescript/no-explicit-any': 'error',
		'typescript/no-unsafe-type-assertion': 'off',
	},
	ignorePatterns: ['dist', '.next', '.astro'],
});
