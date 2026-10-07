import { findFirstLink, walkChain } from './chain.js';
import { pause, requestWiki } from './wiki-api.js';

const languages = ['en', 'es', 'fr', 'de', 'ru', 'nl'];
const input = document.querySelector('#article');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const summary = document.querySelector('#summary');
const go = document.querySelector('#go');
const stop = document.querySelector('#stop');
const suggestions = document.querySelector('#suggestions');
let language = 'en';
let data;
let run;
let search;
let debounce;
const cache = new Map();
let lastRequest = 0;

function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
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
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
  link.textContent = title;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  item.append(link);
  results.append(item);
  message(`Following ${title}… (${results.children.length} articles)`);
}

async function startChain(title, updateHistory = true) {
  run?.abort();
  search?.abort();
  clearTimeout(debounce);
  const controller = new AbortController();
  run = controller;
  title = title.trim() || input.placeholder;
  input.value = title;
  suggestions.replaceChildren();
  results.replaceChildren();
  summary.hidden = true;
  go.disabled = true;
  stop.hidden = false;
  document.title = `${data.copy.title[language]} ${title} — WikiLoopr`;
  if (updateHistory) {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ lang: language, article: title });
    history.pushState(null, '', url);
  }
  message(`Loading ${title}…`);
  try {
    const result = await walkChain({ start: title, loadPage, onPage: addPage, signal: controller.signal });
    if (result.reason === 'loop') {
      results.children[result.loopStart].classList.add('loop-start');
      results.lastElementChild.classList.add('loop-end');
      message(`Loop found! ${result.pages.length - 1} unique articles.`);
      summary.textContent = `${result.loopStart} steps to the loop · ${result.loopLength} articles in the loop · ${result.pages[result.loopStart]} → … → ${result.pages.at(-1)}`;
      summary.hidden = false;
    } else if (result.reason === 'dead-end') {
      message(`Stopped at ${result.pages.at(-1)}: no eligible article link found.`);
    } else {
      message('Stopped after 200 articles without finding a loop. Try another starting article.');
    }
  } catch (error) {
    if (run !== controller || controller.signal.aborted) return;
    message(error.name === 'TimeoutError' ? 'Wikipedia took too long to respond. Please try again.' : error.message, true);
  } finally {
    if (run === controller) {
      go.disabled = false;
      stop.hidden = true;
      run = undefined;
    }
  }
}

function configureLanguage() {
  const params = new URLSearchParams(location.search);
  language = languages.includes(params.get('lang')) ? params.get('lang') : 'en';
  document.documentElement.lang = language;
  const { copy, starts } = data;
  for (const key of ['main', 'asterisk', 'start', 'coded', 'source', 'donating']) {
    const id = { main: 'explanation', asterisk: 'small', start: 'startat' }[key] || key;
    // Trusted, repository-owned translations; article/API text uses textContent.
    document.getElementById(id).innerHTML = (key === 'asterisk' ? '*' : '') + copy[key][language]
      .replaceAll('http://seangransee.com', 'https://seangransee.com')
      .replaceAll('http://wikimediafoundation.org/wiki/Donate/en', 'https://donate.wikimedia.org/');
  }
  for (const link of document.querySelectorAll('#languages a')) {
    if (link.lang === language) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const choices = starts[language];
  input.placeholder = choices[Math.floor(Math.random() * choices.length)];
  document.title = `WikiLoopr — ${copy.frontTitle[language]}`;
  return params.get('article');
}

document.querySelector('#start').addEventListener('submit', event => {
  event.preventDefault();
  if (data) startChain(input.value);
});
stop.addEventListener('click', () => {
  run?.abort();
  message(`Stopped after ${results.children.length} articles. Choose another article to start again.`);
});
input.addEventListener('input', () => {
  clearTimeout(debounce);
  search?.abort();
  suggestions.replaceChildren();
  const term = input.value.trim();
  if (term.length < 2 || run) return;
  debounce = setTimeout(async () => {
    const controller = new AbortController();
    search = controller;
    try {
      const json = await api({ action: 'opensearch', search: term, limit: '8', namespace: '0' }, controller.signal);
      if (search !== controller) return;
      suggestions.replaceChildren(...json[1].map(title => {
        const option = document.createElement('option');
        option.value = title;
        return option;
      }));
    } catch { /* Suggestions are optional; submitting still loads the article. */ }
  }, 250);
});
window.addEventListener('popstate', () => {
  run?.abort();
  search?.abort();
  clearTimeout(debounce);
  const title = configureLanguage();
  if (title) startChain(title, false);
  else {
    input.value = '';
    results.replaceChildren();
    summary.hidden = true;
    message('Choose an article and press Enter or Go.');
  }
});

go.disabled = true;
try {
  const response = await fetch(new URL('./data.json', import.meta.url));
  if (!response.ok) throw new Error('Could not load the app. Please reload the page.');
  data = await response.json();
  const title = configureLanguage();
  go.disabled = false;
  if (title) startChain(title, false);
} catch (error) { message(error.message, true); }
