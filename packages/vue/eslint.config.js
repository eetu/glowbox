import web from '@anarkisti/eslint-config/web';

// Plain-TS render-function component (no SFC) → the /web preset.
export default [...web, { ignores: ['dist/'] }];
