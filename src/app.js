import { findFirstLink, walkChain } from './chain.js';
import { pause, requestWiki } from './wiki-api.js';
import { languages, normalizeArticleInput } from './input.js';

const input = document.querySelector('#article');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const summary = document.querySelector('#side');
const loading = document.querySelector('#loading');
const go = document.querySelector('#go');
const stop = document.querySelector('#stop');
const suggestions = document.querySelector('#suggestions');
let language = 'en';
let data;
let run;
let search;
let debounce;
let activeSuggestion = -1;
let typedTerm = '';
const cache = new Map();
let lastRequest = 0;

function message(text, error = false, visible = error) {
  status.textContent = text;
  status.classList.toggle('error', error);
  if (visible) {
    const item = document.createElement('li');
    item.textContent = text;
    results.append(item);
  }
}

async function api(parameters, signal) {
  await pause(Math.max(0, 600 - (Date.now() - lastRequest)), signal);
  lastRequest = Date.now();
  return requestWiki({ language, parameters, signal, onRetry: () => {
    if (parameters.action === 'parse') message('Wikipedia is busy. Waiting before retrying…');
  } });
}

async function loadPage(title, signal) {
  const key = `${language}:${title}`;
  if (cache.has(key)) return cache.get(key);
  const json = await api({ action: 'parse', page: title, redirects: '1', prop: 'text', formatversion: '2', disableeditsection: '1' }, signal);
  const parsed = new DOMParser().parseFromString(json.parse.text, 'text/html');
  const page = { title: json.parse.title, next: findFirstLink(parsed, language, json.parse.title) };
  cache.set(key, page);
  cache.set(`${language}:${page.title}`, page);
  return page;
}

function addPage(title) {
  results.querySelector('a.end1')?.classList.remove('end1');
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
  link.textContent = title;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.classList.add('end1');
  item.append(link);
  results.append(item);
  window.scrollTo(0, item.getBoundingClientRect().top + window.scrollY);
  message(`Following ${title}… (${results.children.length} articles)`);
}

function cancelWork() {
  run?.abort();
  search?.abort();
  clearTimeout(debounce);
  run = undefined;
  search = undefined;
  clearSuggestions();
  go.disabled = !data;
  input.disabled = !data;
  stop.hidden = true;
  loading.hidden = true;
}

function clearSuggestions() {
  suggestions.replaceChildren();
  suggestions.hidden = true;
  activeSuggestion = -1;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}

function showSuggestions(titles) {
  clearSuggestions();
  if (!titles.length || document.activeElement !== input) return;
  const bounds = input.getBoundingClientRect();
  suggestions.style.left = `${bounds.left + window.scrollX}px`;
  suggestions.style.top = `${bounds.bottom + window.scrollY}px`;
  // The original jQuery UI menu has 2px padding and 1px borders on each side;
  // its outer width matches the input, rather than adding these six pixels.
  suggestions.style.minWidth = `${Math.max(0, bounds.width - 6)}px`;
  suggestions.replaceChildren(...titles.map((title, index) => {
    const item = document.createElement('li');
    item.className = 'ui-menu-item';
    item.setAttribute('role', 'option');
    item.id = `suggestion-${index}`;
    const link = document.createElement('a');
    link.className = 'ui-corner-all';
    link.textContent = title;
    item.append(link);
    item.addEventListener('mousedown', event => event.preventDefault());
    item.addEventListener('mouseenter', () => selectSuggestion(index, false));
    item.addEventListener('click', () => startChain(title));
    return item;
  }));
  suggestions.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function selectSuggestion(index, updateInput = true) {
  activeSuggestion = index;
  for (const [i, item] of Array.from(suggestions.children).entries()) {
    item.firstElementChild.classList.toggle('ui-state-hover', i === index);
    item.setAttribute('aria-selected', String(i === index));
  }
  const selected = suggestions.children[index];
  if (selected) {
    input.setAttribute('aria-activedescendant', selected.id);
    if (updateInput) input.value = selected.textContent;
  } else {
    input.removeAttribute('aria-activedescendant');
    if (updateInput) input.value = typedTerm;
  }
}

async function startChain(title, updateHistory = true) {
  cancelWork();
  results.replaceChildren();
  summary.hidden = true;
  let selection;
  try { selection = normalizeArticleInput(title.trim() || input.placeholder, language); }
  catch (error) { message(error.message, true); return; }
  if (selection.language !== language) configureLanguage(selection.language);
  title = selection.title;
  const controller = new AbortController();
  run = controller;
  input.value = title;
  input.disabled = true;
  input.blur();
  go.disabled = true;
  loading.hidden = false;
  document.title = `${data.copy.title[language]} ${title}`;
  if (updateHistory) {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ lang: language, article: title });
    if (url.href !== location.href) history.pushState(null, '', url);
  }
  message(`Loading ${title}…`);
  try {
    const result = await walkChain({ start: title, loadPage, onPage: addPage, signal: controller.signal });
    if (result.reason === 'loop') {
      results.children[result.loopStart].classList.add('loop-start');
      results.lastElementChild.classList.add('loop-end');
      results.children[result.loopStart].firstElementChild.classList.add('end');
      results.lastElementChild.firstElementChild.classList.add('end');
      const unique = result.pages.length - 1;
      message(`Loop found! ${unique} unique ${unique === 1 ? 'article' : 'articles'}.`);
      summary.querySelector('.first').textContent = result.pages[0];
      summary.querySelector('.initialLength').textContent = result.loopStart;
      summary.querySelector('.loopstart').textContent = result.pages[result.loopStart];
      summary.querySelector('.loopLength').textContent = result.loopLength;
      summary.querySelector('.loopend').textContent = result.pages.at(-1);
      summary.hidden = false;
    } else if (result.reason === 'dead-end') {
      message(`Stopped at ${result.pages.at(-1)}: no eligible article link found.`, false, true);
    } else {
      message('Stopped after 200 articles without finding a loop. Try another starting article.', false, true);
    }
  } catch (error) {
    if (run !== controller || controller.signal.aborted) return;
    message(error.name === 'TimeoutError' ? 'Wikipedia took too long to respond. Please try again.' : error.message, true);
  } finally {
    if (run === controller) {
      go.disabled = false;
      input.disabled = false;
      stop.hidden = true;
      loading.hidden = true;
      run = undefined;
    }
  }
}

function configureLanguage(override) {
  const params = new URLSearchParams(location.search);
  language = override || (languages.includes(params.get('lang')) ? params.get('lang') : 'en');
  document.documentElement.lang = language;
  document.querySelector('a[aria-label="WikiLoopr home"]').href = `?lang=${language}`;
  const { copy, starts } = data;
  for (const key of ['main', 'asterisk', 'start', 'coded', 'source']) {
    const id = { main: 'explanation', asterisk: 'small', start: 'startat' }[key] || key;
    // Trusted, repository-owned translations; article/API text uses textContent.
    document.getElementById(id).innerHTML = (key === 'asterisk' ? '*' : '') + copy[key][language]
      .replaceAll('http://seangransee.com', 'https://seangransee.com');
  }
  for (const link of document.querySelectorAll('#languages a')) {
    if (link.lang === language) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const choices = starts[language];
  input.placeholder = choices[Math.floor(Math.random() * choices.length)];
  document.title = `WikiLoopr - ${copy.frontTitle[language]}`;
  document.querySelector('meta[name="description"]').content = copy.description[language];
  for (const link of document.querySelectorAll('.bottom a')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Opens in a new window';
  }
  return params.get('article');
}

document.querySelector('#start').addEventListener('submit', event => {
  event.preventDefault();
  if (data) startChain(input.value);
});
stop.addEventListener('click', () => {
  cancelWork();
  message(`Stopped after ${results.children.length} articles. Choose another article to start again.`);
});
input.addEventListener('input', () => {
  clearTimeout(debounce);
  search?.abort();
  clearSuggestions();
  const term = input.value.trim();
  typedTerm = input.value;
  if (term.length < 1 || run) return;
  debounce = setTimeout(async () => {
    const controller = new AbortController();
    search = controller;
    try {
      const json = await api({ action: 'opensearch', search: term, limit: '10', namespace: '0' }, controller.signal);
      if (search !== controller) return;
      showSuggestions(json[1]);
    } catch { /* Suggestions are optional; submitting still loads the article. */ }
  }, 250);
});
input.addEventListener('blur', clearSuggestions);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !suggestions.hidden && activeSuggestion >= 0) {
    input.value = suggestions.children[activeSuggestion].textContent;
  }
  if (suggestions.hidden || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  const count = suggestions.children.length;
  const next = activeSuggestion < 0
    ? (event.key === 'ArrowDown' ? 0 : count - 1)
    : activeSuggestion + (event.key === 'ArrowDown' ? 1 : -1);
  selectSuggestion(next < 0 || next >= count ? -1 : next);
});
window.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (run) {
    cancelWork();
    message(`Stopped after ${results.children.length} articles. Choose another article to start again.`);
  } else {
    if (!suggestions.hidden) input.value = typedTerm;
    clearSuggestions();
  }
});
// Match the original loop endpoint animation without changing the link layout.
window.setInterval(() => {
  const endpoints = Array.from(results.querySelectorAll('a.end'));
  if (endpoints.length === 2) endpoints.forEach(link => link.classList.toggle('end1'));
}, 1000);
window.addEventListener('popstate', () => {
  cancelWork();
  if (!data) return;
  const title = configureLanguage();
  if (title) startChain(title, false);
  else {
    input.value = '';
    results.replaceChildren();
    summary.hidden = true;
    message('Choose an article and press Enter.');
  }
});

go.disabled = true;
input.disabled = true;
try {
  const response = await fetch(new URL('./data.json', import.meta.url));
  if (!response.ok) throw new Error('Could not load the app. Please reload the page.');
  data = await response.json();
  const title = configureLanguage();
  go.disabled = false;
  input.disabled = false;
  if (title) startChain(title, false);
} catch (error) { message(error.message, true); }
