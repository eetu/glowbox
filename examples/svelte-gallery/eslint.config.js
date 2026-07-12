import svelte from '@anarkisti/eslint-config/svelte';

import svelteConfig from './svelte.config.js';

export default [
	...svelte(svelteConfig),
	{ ignores: ['dist/', 'build/', '.svelte-kit/', 'playwright-report/', 'test-results/'] }
];
