import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArticleInput } from '../src/input.js';

test('preserves special-character article titles while normalizing whitespace and underscores', () => {
  assert.deepEqual(normalizeArticleInput('  C++  '), { title: 'C++', language: 'en' });
  assert.equal(normalizeArticleInput('Star_Trek:_The_Next_Generation').title, 'Star Trek: The Next Generation');
});

test('accepts desktop, mobile, encoded, and query-style Wikipedia article URLs', () => {
  assert.deepEqual(normalizeArticleInput('https://en.wikipedia.org/wiki/Philosophy#History'), { title: 'Philosophy', language: 'en' });
  assert.deepEqual(normalizeArticleInput('https://fr.m.wikipedia.org/wiki/%C3%89nergie'), { title: 'Énergie', language: 'fr' });
  assert.deepEqual(normalizeArticleInput('de.wikipedia.org/wiki/Objekt_(Philosophie)'), { title: 'Objekt (Philosophie)', language: 'de' });
  assert.deepEqual(normalizeArticleInput('//en.wikipedia.org/w/index.php?title=C%2B%2B'), { title: 'C++', language: 'en' });
});

test('rejects unsupported editions, non-Wikipedia URLs, and broken article URLs', () => {
  assert.throws(() => normalizeArticleInput('https://ja.wikipedia.org/wiki/Foo'), /not supported/);
  assert.throws(() => normalizeArticleInput('https://en.wikipedia.org.example.com/wiki/Philosophy'), /Wikipedia article/);
  assert.throws(() => normalizeArticleInput('https://en.wikipedia.org/wiki/'), /Wikipedia article/);
  assert.throws(() => normalizeArticleInput('https://en.wikipedia.org/wiki/%broken'), /invalid article/);
});
