import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/images', { recursive: true });
await Promise.all([
  copyFile('CNAME', 'dist/CNAME'),
  copyFile('images/og-preview.png', 'dist/images/og-preview.png'),
  copyFile('images/og-preview.svg', 'dist/images/og-preview.svg')
]);
