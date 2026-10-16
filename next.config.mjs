import { fileURLToPath } from 'node:url';

// Keep this isolated FREE release independent of its parent checkout.
const root = fileURLToPath(new URL('.', import.meta.url));
const config = { turbopack: { root }, outputFileTracingRoot: root };
export default config;
