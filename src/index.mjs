// ESM wrapper for the CommonJS public API.
// Uses createRequire to load the CJS entry without a build step. Keeps the
// repo zero-dep while supporting `import { repair } from 'ahmad-awais-deepseek-v4-toolrepair'`.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('./index.js');

export const repair = api.repair;
export const shapeFixes = api.shapeFixes;
export const autolinkFix = api.autolinkFix;
export const relationalFix = api.relationalFix;

export default api;
