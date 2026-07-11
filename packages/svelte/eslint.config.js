import svelte from '@anarkisti/eslint-config/svelte';

import svelteConfig from './svelte.config.js';

// House svelte preset (node base + eslint-plugin-svelte + TS parser); the factory
// threads svelte.config.js into the parser for svelte-aware rules.
export default [...svelte(svelteConfig), { ignores: ['dist/', '.svelte-kit/'] }];
