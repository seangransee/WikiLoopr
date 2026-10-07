import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { articleTitle, findFirstLink, walkChain } from '../src/chain.js';

function first(html, language = 'en') {
  const dom = new JSDOM(`<div class="mw-parser-output">${html}</div>`);
  try { return findFirstLink(dom.window.document, language, 'Starting article'); }
  finally { dom.window.close(); }
}

test('skips sidebars, nested parentheses, italics, red links, and namespaces', () => {
  assert.equal(first(`
    <div class="hatnote"><p><a href="/wiki/Hatnote">hatnote</a></p></div>
    <table class="infobox"><tr><td><p><a href="/wiki/Sidebar">sidebar</a></p></td></tr></table>
    <p><b>Definition</b> (outer (<a href="/wiki/Nested">nested</a>)
    <a href="/wiki/Pronunciation">pronunciation</a>)
    <i><a href="/wiki/Italic">italic</a></i>
    <a class="new" href="/wiki/Missing">missing</a>
    <a href="/wiki/Help:Example">help</a>
    <a href="https://example.com/wiki/External">external</a>
    <a href="/wiki/First_article#Section">first</a></p>`), 'First article');
});

test('supports encoded multilingual titles and list-only articles', () => {
  assert.equal(first('<p>No links.</p><ul><li><a href="/wiki/%C3%89nergie">énergie</a></li></ul>', 'fr'), 'Énergie');
  assert.equal(articleTitle('//de.wikipedia.org/wiki/Physik', 'de'), 'Physik');
  assert.equal(articleTitle('https://fr.wikipedia.org/wiki/Physique', 'en'), null);
  assert.equal(articleTitle('/wiki/Starting_article', 'en', 'Starting article'), null);
  assert.equal(first('<p>Plain text only.</p>'), null);
  assert.equal(articleTitle('/wiki/Star_Trek:_The_Next_Generation', 'en'), 'Star Trek: The Next Generation');
  assert.equal(articleTitle('/wiki/Benutzer:Beispiel', 'de'), null);
  assert.equal(articleTitle('/wiki/Cat%C3%A9gorie:Physique', 'fr'), null);
});

test('counts parentheses across italic and bold formatting without following their links', () => {
  assert.equal(first('<p>Example (<i>aside)</i>, then <a href="/wiki/Correct">correct</a>.</p>'), 'Correct');
  assert.equal(first('<p><i>(aside</i> <a href="/wiki/Inside">inside</a>) then <a href="/wiki/Correct">correct</a>.</p>'), 'Correct');
  assert.equal(first('<p>(<b>aside)</b> <a href="/wiki/Correct">correct</a>.</p>'), 'Correct');
  assert.equal(first('<p><i><a href="/wiki/Italic">italic</a></i> <a href="/wiki/Correct">correct</a>.</p>'), 'Correct');
});

test('finds loops using canonical titles, including redirects', async () => {
  const emitted = [];
  const graph = {
    Alias: { title: 'Start', next: 'B' },
    B: { title: 'B', next: 'C' },
    C: { title: 'C', next: 'Redirect to B' },
    'Redirect to B': { title: 'B', next: 'C' }
  };
  const result = await walkChain({ start: 'Alias', loadPage: async title => graph[title], onPage: title => emitted.push(title) });
  assert.deepEqual(result, { reason: 'loop', pages: ['Start', 'B', 'C', 'B'], loopStart: 1, loopLength: 2 });
  assert.deepEqual(emitted, result.pages);
});

test('terminates on dead ends and bounded chains', async () => {
  const end = await walkChain({ start: 'End', loadPage: async title => ({ title, next: null }), onPage() {} });
  assert.equal(end.reason, 'dead-end');
  const limit = await walkChain({ start: '1', maxPages: 3, loadPage: async title => ({ title, next: String(Number(title) + 1) }), onPage() {} });
  assert.deepEqual(limit, { reason: 'limit', pages: ['1', '2', '3'] });
});

test('aborted requests cannot append stale results and errors propagate', async () => {
  const controller = new AbortController();
  let appended = false;
  await assert.rejects(walkChain({ start: 'A', signal: controller.signal, loadPage: async () => { controller.abort(); return { title: 'A', next: 'B' }; }, onPage() { appended = true; } }), { name: 'AbortError' });
  assert.equal(appended, false);
  await assert.rejects(walkChain({ start: 'A', loadPage: async () => { throw new Error('Missing article'); }, onPage() {} }), /Missing article/);
});
