export function pause(milliseconds, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function requestWiki({ language, parameters, signal, onRetry = () => {}, fetchImpl = fetch, sleep = pause }) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({ format: 'json', origin: '*', ...parameters });
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      credentials: 'omit',
      headers: { 'Api-User-Agent': 'WikiLoopr/2.0 (https://github.com/seangransee/WikiLoopr)' }
    });
    if ([429, 503].includes(response.status) && attempt < 2) {
      const retryAfter = response.headers.get('Retry-After');
      const seconds = retryAfter === null ? 15 * (attempt + 1) : Number(retryAfter);
      const wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
      if (wait > 60000) throw new Error('Wikipedia is busy. Please try again in a few minutes.');
      onRetry();
      await sleep(Math.max(1000, wait || 15000), signal);
      continue;
    }
    if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}. Please try again.`);
    const json = await response.json();
    if (json.error) throw new Error(json.error.info || 'Wikipedia could not find this article.');
    return json;
  }
}
