// Build the serverless site from source, translations, and the original start lists.
// Current state: reproducible static output for GitHub Pages, at either / or /WikiLoopr/.
// Post-run notes: dist is disposable; deployment uploads only this directory.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('src/', root), output, { recursive: true });
await mkdir(new URL('assets/', output));
for (const name of ['logo.png', 'favicon.png', 'looparrow.png', 'downarrow.png']) {
  await cp(new URL(`public/${name}`, root), new URL(`assets/${name}`, output));
}
const copy = JSON.parse(await readFile(new URL('copy.json', root), 'utf8'));
const starts = {};
for (const language of Object.keys(copy.main)) {
  starts[language] = (await readFile(new URL(`startlists/${language}.startlist.txt`, root), 'utf8'))
    .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}
await writeFile(new URL('data.json', output), JSON.stringify({ copy, starts }));
await writeFile(new URL('.nojekyll', output), '');
await cp(new URL('CNAME', root), new URL('CNAME', output));
console.log(`Built WikiLoopr in ${fileURLToPath(output)}`);
