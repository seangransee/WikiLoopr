// Serve the production static build locally without a Ruby server or bundler.
// Current state: development-only HTTP server bound to loopback, default port 4173.
// Post-run notes: run npm start; press Ctrl-C to stop. PORT overrides the port.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
createServer(async (request, response) => {
  try {
    const path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Invalid path');
    const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'text/plain' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log(`WikiLoopr: http://127.0.0.1:${process.env.PORT || 4173}`);
});
