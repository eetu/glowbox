import web from '@anarkisti/eslint-config/web';

// Plain browser / vanilla-TS (2D canvas, no framework) → the /web preset.
// tools/ is the dev-only node converter (JHF → faces), not shipped code.
export default [...web, { ignores: ['dist/', 'tools/'] }];
