import web from '@anarkisti/eslint-config/web';

// Plain browser / vanilla-TS (WebGL, no framework) → the /web preset.
export default [...web, { ignores: ['dist/'] }];
