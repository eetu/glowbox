import web from '@anarkisti/eslint-config/web';

// Plain browser / vanilla-TS (2D canvas, no framework) → the /web preset.
export default [...web, { ignores: ['dist/'] }];
