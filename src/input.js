export const languages = ['en', 'es', 'fr', 'de', 'ru', 'nl'];

export function normalizeArticleInput(value, language = 'en') {
  let title = value.trim();
  const isUrl = /^(https?:\/\/|\/\/|[a-z-]+(?:\.m)?\.wikipedia\.org\/)/i.test(title);
  if (isUrl) {
    let url;
    try { url = new URL(title.startsWith('//') ? `https:${title}` : /^https?:/i.test(title) ? title : `https://${title}`); }
    catch { throw new Error('Enter a Wikipedia article title or a Wikipedia article URL.'); }
    const edition = url.hostname.match(/^([a-z-]+)(?:\.m)?\.wikipedia\.org$/i)?.[1];
    if (!edition) throw new Error('Enter a Wikipedia article title or a Wikipedia article URL.');
    if (!languages.includes(edition)) throw new Error('This Wikipedia language is not supported. Choose one of the languages above.');
    language = edition;
    try {
      title = url.pathname.startsWith('/wiki/') ? decodeURIComponent(url.pathname.slice(6))
        : url.pathname === '/w/index.php' ? url.searchParams.get('title') || '' : '';
    } catch { throw new Error('This Wikipedia URL has an invalid article title.'); }
  }
  title = title.replaceAll('_', ' ').trim();
  if (!title) throw new Error('Enter a Wikipedia article title or a Wikipedia article URL.');
  return { title, language };
}
