// Parse only prose, ignoring sidebars, pronunciation, notes, and navigation.
const excluded = '.infobox, .hatnote, .dablink, .thumb, .vcard, .vertical-navbox, .metadata, .ambox, #coordinates, .geography, .right, .toc, .nowraplinks, .collapsible, .collapsed, .navbox, .navbox-inner, .toccolours, .biota, .infobox_v2, .NavHead, .NavContent, .sidebar, .mw-references-wrap, .reflist, .reference, .shortdescription, .noprint, .sistersitebox, .portal, .mw-editsection, style, script, table';
const inlineExcluded = 'i, em, b, strong, sup, small, .new, .extiw, .IPA, .unicode, .external, [title="Help:Pronunciation respelling key"]';
// English namespace aliases work across editions; include localized namespaces.
// Colons also occur in real article titles (e.g. Star Trek: The Next Generation).
const namespaces = new Set([
  'media', 'special', 'talk', 'user', 'user talk', 'wikipedia', 'wikipedia talk',
  'file', 'file talk', 'image', 'image talk', 'mediawiki', 'mediawiki talk',
  'template', 'template talk', 'help', 'help talk', 'category', 'category talk',
  'portal', 'portal talk', 'draft', 'draft talk', 'module', 'module talk',
  'timedtext', 'book', 'book talk', 'topic',
  'especial', 'discusión', 'usuario', 'usuario discusión', 'wikipedia discusión',
  'archivo', 'archivo discusión', 'plantilla', 'plantilla discusión', 'ayuda',
  'ayuda discusión', 'categoría', 'categoría discusión', 'portal discusión',
  'anexo', 'anexo discusión', 'módulo', 'módulo discusión',
  'spécial', 'discussion', 'utilisateur', 'discussion utilisateur', 'discussion wikipédia', 'wikipédia',
  'fichier', 'discussion fichier', 'modèle', 'discussion modèle', 'aide', 'discussion aide',
  'catégorie', 'discussion catégorie', 'portail', 'discussion portail', 'projet', 'discussion projet',
  'discussion module', 'spezial', 'diskussion', 'benutzer', 'benutzer diskussion',
  'wikipedia diskussion', 'datei', 'datei diskussion', 'vorlage', 'vorlage diskussion',
  'hilfe', 'hilfe diskussion', 'kategorie', 'kategorie diskussion', 'portal diskussion',
  'modul', 'modul diskussion', 'speciaal', 'overleg', 'gebruiker', 'overleg gebruiker',
  'overleg wikipedia', 'bestand', 'overleg bestand', 'sjabloon', 'overleg sjabloon',
  'overleg help', 'categorie', 'overleg categorie', 'portaal', 'overleg portaal', 'overleg module',
  'медиа', 'служебная', 'обсуждение', 'участник', 'обсуждение участника',
  'участница', 'обсуждение участницы', 'википедия', 'обсуждение википедии',
  'файл', 'обсуждение файла', 'шаблон', 'обсуждение шаблона', 'справка', 'обсуждение справки',
  'категория', 'обсуждение категории', 'портал', 'обсуждение портала', 'проект',
  'обсуждение проекта', 'модуль', 'обсуждение модуля', 'инкубатор', 'обсуждение инкубатора'
]);

export function articleTitle(href, language, currentTitle = '') {
  if (!href || href.startsWith('#')) return null;
  let url;
  try { url = new URL(href, `https://${language}.wikipedia.org`); } catch { return null; }
  if (url.hostname !== `${language}.wikipedia.org` || !['https:', 'http:'].includes(url.protocol) || !url.pathname.startsWith('/wiki/')) return null;
  let title;
  try { title = decodeURIComponent(url.pathname.slice(6)).replaceAll('_', ' '); } catch { return null; }
  const prefix = title.slice(0, title.indexOf(':')).trim().toLowerCase();
  if (!title || (title.includes(':') && namespaces.has(prefix)) || title === currentTitle.replaceAll('_', ' ')) return null;
  return title;
}

export function findFirstLink(document, language, currentTitle) {
  document.querySelectorAll(excluded).forEach(element => element.remove());
  const root = document.querySelector('.mw-parser-output') || document.body;
  // Prefer paragraphs; use list prose for articles with no eligible paragraph link.
  for (const selector of ['p', 'ul > li, ol > li']) {
    for (const paragraph of root.querySelectorAll(selector)) {
      let depth = 0;
      function visit(node, suppressLinks = false) {
        if (node.nodeType === 3) {
          for (const char of node.textContent) {
            if (char === '(' || char === '（') depth++;
            if (char === ')' || char === '）') depth = Math.max(0, depth - 1);
          }
          return null;
        }
        if (node.nodeType !== 1) return null;
        // Formatting can contain a parenthesis opened/closed in adjacent text.
        // Read its text to maintain depth while ignoring its links.
        const skipLinks = suppressLinks || node.matches(inlineExcluded);
        if (node.tagName === 'A' && depth === 0 && !skipLinks) {
          const title = articleTitle(node.getAttribute('href'), language, currentTitle);
          if (title) return title;
        }
        for (const child of node.childNodes) {
          const found = visit(child, skipLinks);
          if (found) return found;
        }
        return null;
      }
      const title = visit(paragraph);
      if (title) return title;
    }
  }
  return null;
}

export async function walkChain({ start, loadPage, onPage, signal, maxPages = 200 }) {
  const visited = new Map();
  const pages = [];
  let title = start;
  while (pages.length < maxPages) {
    signal?.throwIfAborted();
    const page = await loadPage(title, signal);
    signal?.throwIfAborted();
    const loopStart = visited.get(page.title);
    pages.push(page.title);
    onPage(page.title);
    if (loopStart !== undefined) return { reason: 'loop', pages, loopStart, loopLength: pages.length - 1 - loopStart };
    visited.set(page.title, pages.length - 1);
    if (!page.next) return { reason: 'dead-end', pages };
    title = page.next;
  }
  return { reason: 'limit', pages };
}
