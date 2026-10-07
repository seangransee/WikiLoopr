import test from 'node:test';
import assert from 'node:assert/strict';
import { pause, requestWiki } from '../src/wiki-api.js';

test('honors Wikipedia throttling before retrying the same request', async () => {
  const signal = new AbortController().signal;
  let calls = 0;
  const waits = [];
  const result = await requestWiki({ language: 'en', parameters: { action: 'parse', page: 'A & B' }, signal,
    fetchImpl: async url => {
      assert.equal(url.searchParams.get('page'), 'A & B');
      assert.equal(url.searchParams.get('origin'), '*');
      calls++;
      return calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '15' } }) : Response.json({ parse: { title: 'A & B' } });
    }, sleep: async milliseconds => waits.push(milliseconds)
  });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [15000]);
  assert.equal(result.parse.title, 'A & B');
});

test('Stop cancels backoff immediately', async () => {
  const controller = new AbortController();
  const waiting = pause(60000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
});
