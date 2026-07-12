import web from '@anarkisti/eslint-config/web';

// Plain browser / vanilla-TS content helpers → the /web preset.
export default [...web, { ignores: ['dist/'] }];
