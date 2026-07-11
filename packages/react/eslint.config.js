import react from '@anarkisti/eslint-config/react';

// React wrapper → the /react preset (hooks + JSX rules).
export default [...react, { ignores: ['dist/'] }];
