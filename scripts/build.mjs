import { mkdir, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'src', 'assets', 'config']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
console.log('Static GitHub Pages build ready in dist/');
