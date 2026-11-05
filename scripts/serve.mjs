import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { root } from './build.mjs';

const base = join(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const execute = promisify(execFile);
// A fresh process also reloads templates and configuration instead of keeping
// the original imported build function in Node's module cache.
let building = Promise.resolve();
createServer(async (request, response) => {
  try {
    building = building.catch(() => {}).then(() => execute(process.execPath, [join(root, 'scripts/build.mjs')], { windowsHide: true }));
    await building;
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let path = resolve(base, `.${pathname}`);
    if (path !== base && !path.startsWith(base + sep)) { response.writeHead(403).end(); return; }
    try { if ((await stat(path)).isDirectory()) path = join(path, 'index.html'); }
    catch { /* Read below will return the custom 404. */ }
    let bytes;
    try { bytes = await readFile(path); }
    catch {
      bytes = await readFile(join(base, '404.html'));
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(bytes);
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
  } catch (error) { console.error(error); response.writeHead(500).end('Build failed. See terminal.'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173/it/'));
