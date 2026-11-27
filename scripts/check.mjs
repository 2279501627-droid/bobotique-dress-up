import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validateCatalog } from '../src/assets/catalog.js';
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (path.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status) process.exit(result.status);
    }
  }
}
await check('src');
const configURL = new URL('../config/catalog.json', import.meta.url);
const catalog = validateCatalog(JSON.parse(await readFile(configURL, 'utf8')), 'https://example.org/game/config/catalog.json');
for (const item of [...catalog.characters, ...catalog.products, ...catalog.environments]) {
  if (item.path && !/^https?:/.test(item.path)) await access(new URL(item.path, configURL));
}
console.log('All modules, catalogue and local asset paths checked.');
