// Cross-platform replacement for `cp build/index.html build/404.html`
// (the original script failed on Windows). Lets a static host serve client-side routes.
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'build';
const src = join(dir, 'index.html');

if (!existsSync(src)) {
  console.error(`copy-404: ${src} not found – did "vite build" succeed?`);
  process.exit(1);
}

copyFileSync(src, join(dir, '404.html'));
console.log('copy-404: build/404.html written');
