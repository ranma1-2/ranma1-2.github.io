import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { loadComparison, renderComparison, comparisonCard } from './comparison.mjs';
import { loadTrending, renderTrending, trendingCard } from './trending.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const copy = {
  en: { home: 'Home', resources: 'Content', explore: 'Explore the content', language: 'Language', title: 'Content', read: 'Read the guide', voting: 'The voting guide', tag: 'RANMA ½ INDEX', back: 'All content', updated: 'Updated', edition: 'Edition', toc: 'ON THIS PAGE', fallback: 'This page is not available in English. The English version is shown below.', outdated: 'This translation may be out of date. Read the latest English version.', footer: 'An unofficial fan project. Not affiliated with the creators or rights holders.', missing: 'English fallback', stale: 'Translation to update', error: 'Page not found', errorText: 'The page may have moved. Start again from the index.' },
  it: { home: 'Home', resources: 'Contenuti', explore: 'Esplora i contenuti', language: 'Lingua', title: 'Contenuti', read: 'Leggi la guida', voting: 'La guida al voto', tag: 'RANMA ½ INDEX', back: 'Tutti i contenuti', updated: 'Aggiornamento', edition: 'Edizione', toc: 'IN QUESTA PAGINA', fallback: 'Questa pagina non è ancora disponibile in italiano. Stai leggendo la versione inglese.', outdated: 'Questa traduzione potrebbe non essere aggiornata. Leggi l’ultima versione inglese.', footer: 'Un progetto non ufficiale dei fan. Non affiliato agli autori o ai titolari dei diritti.', missing: 'Disponibile in inglese', stale: 'Traduzione da aggiornare', error: 'Pagina non trovata', errorText: 'La pagina potrebbe essere stata spostata. Riparti dai contenuti.' },
};

export function parseContent(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Missing metadata block');
  const meta = Object.fromEntries(match[1].split('\n').filter(Boolean).map(line => {
    const colon = line.indexOf(':');
    if (colon < 1) throw new Error(`Invalid metadata: ${line}`);
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
  }));
  for (const key of ['title', 'description', 'revision', 'updated', 'edition']) if (!meta[key]) throw new Error(`Missing ${key}`);
  if (!/^\d+$/.test(meta.revision)) throw new Error('revision must be an integer');
  return { meta, body: match[2] };
}

const safeUrl = value => /^(https?:\/\/|mailto:|\/|#)/i.test(value) && !value.startsWith('//') ? escape(value) : '#';
const languageName = lang => `<span class="language-name">${config.languageFlags?.[lang] ? `<img class="language-flag" src="${safeUrl(config.languageFlags[lang])}" alt="" width="21" height="14">` : ''}${escape(config.languages[lang])}</span>`;
function inline(value) {
  const tokens = [];
  const token = html => { tokens.push(html); return `\u0000${tokens.length - 1}\u0000`; };
  const source = value.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_, alt, url) => token(`<img src="${safeUrl(url)}" alt="${escape(alt)}" loading="lazy" width="1100" height="530">`))
    .replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, url) => token(`<a href="${safeUrl(url)}">${escape(label)}</a>`));
  return escape(source).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
}

// Deliberately small Markdown subset: headings, paragraphs, bullets, quotes,
// links, images, bold and inline code. Raw HTML is escaped.
export function markdown(body) {
  const headings = [];
  const html = body.trim().split(/\n\s*\n/).map(block => {
    const heading = block.match(/^(#{1,3}) (.+)$/);
    if (heading) {
      const level = heading[1].length;
      const id = `section-${headings.length + 1}`;
      headings.push({ id, level, text: heading[2] });
      return `<h${level} id="${id}">${inline(heading[2])}</h${level}>`;
    }
    if (block.split('\n').every(line => line.startsWith('- '))) return `<ul>${block.split('\n').map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
    if (block.startsWith('> ')) return `<aside class="note">${inline(block.replace(/^> ?/gm, '').replace(/\n/g, ' '))}</aside>`;
    return `<p>${inline(block.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
  return { html, headings };
}

export async function build({ contentDir = join(root, 'content'), outDir = join(root, 'dist') } = {}) {
  const comparisonData = await loadComparison(new URL('../', import.meta.url));
  const trendingData = await loadTrending(new URL('../', import.meta.url));
  await mkdir(outDir, { recursive: true });
  await cp(join(root, 'public'), outDir, { recursive: true });
  const contents = {};
  for (const lang of Object.keys(config.languages)) {
    if (!copy[lang]) throw new Error(`Add interface translations for ${lang} in scripts/build.mjs`);
    contents[lang] = {};
    for (const page of config.pages) {
      try { contents[lang][page.id] = parseContent(await readFile(join(contentDir, lang, `${page.id}.md`), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const english = contents[config.defaultLanguage];
  for (const page of config.pages) if (!english[page.id]) throw new Error(`Missing English source: ${page.id}`);
  const url = (lang, page) => `/${lang}/${page.path}`;
  for (const lang of Object.keys(config.languages)) {
    const t = copy[lang];
    const comparison = renderComparison(comparisonData, lang);
    for (const page of config.pages) {
      const local = contents[lang][page.id];
      const source = local || english[page.id];
      const actualLang = local ? lang : config.defaultLanguage;
      const stale = local && Number(local.meta.revision) < Number(english[page.id].meta.revision);
      const warning = !local ? `<aside class="notice" role="status">${escape(t.fallback)} <a href="${url('en', page)}">English →</a></aside>` : stale ? `<aside class="notice" role="status">${escape(t.outdated)} <a href="${url('en', page)}">English →</a></aside>` : '';
      const languageLinks = Object.entries(config.languages).map(([key]) => {
        const available = contents[key][page.id];
        const fallbackLabel = available ? '' : ` · ${escape(t.missing)}`;
        return `<a href="${url(key, page)}" hreflang="${key}"${key === lang ? ' aria-current="true"' : ''}>${languageName(key)}${fallbackLabel}${key === lang ? ' ✓' : ''}</a>`;
      }).join('');
      const rendered = markdown(source.body);
      const guide = contents[lang].voting || english.voting;
      const card = `<a class="guide-card" href="/${lang}/guides/voting/"><div class="card-art" aria-hidden="true"><span class="ballot">✓</span><span class="art-number">01</span></div><div class="card-copy"><span class="eyebrow">${escape(t.voting)}</span><h3>${escape(guide.meta.title)}</h3><p>${escape(guide.meta.description)}</p><span class="card-link">${escape(t.read)} <span>↗</span></span></div></a>`;
      const comparisonContent = `<div class="breadcrumbs"><a href="/${lang}/">← ${escape(t.back)}</a></div><header class="article-header comparison-header"><h1>${escape(source.meta.title)}</h1></header>${page.id === 'comparison' && source.body.trim() ? `<div class="prose">${rendered.html}</div>` : ''}${comparison.html}`;
      const trendingContent = `<div class="breadcrumbs"><a href="/${lang}/">← ${escape(t.back)}</a></div><header class="article-header comparison-header"><h1>${escape(source.meta.title)}</h1></header>${page.id === 'trending' && source.body.trim() ? `<div class="prose">${rendered.html}</div>` : ''}${renderTrending(trendingData, lang)}`;
      const content = page.id === 'trending' ? trendingContent : page.id === 'comparison' ? comparisonContent : page.id === 'home'
        ? `<section class="hero"><div><span class="eyebrow">${escape(t.tag)}</span><h1>${escape(source.meta.title)}</h1><p class="lead">${escape(source.meta.description)}</p><a class="button" href="#guides">${escape(t.explore)} <span>↓</span></a></div><div class="hero-art" aria-hidden="true"><div class="sun"></div><span class="half">½</span><span class="art-label">RANMA ½<br>INDEX</span><span class="stamp">RESOURCE<br>INDEX</span></div></section><section class="home-guides" id="guides"><div class="section-title"><h2>${escape(t.title)}</h2><span>${String(config.pages.length - 1).padStart(2, '0')} / ${escape(t.resources)}</span></div>${card}${comparisonCard(lang)}${trendingCard(lang)}<div class="intro-copy" lang="${actualLang}">${rendered.html}</div></section>`
        : `<div class="breadcrumbs"><a href="/${lang}/">← ${escape(t.back)}</a><span>GUIDE / 01</span></div><header class="article-header" lang="${actualLang}"><span class="eyebrow">${escape(t.voting)}</span><h1>${escape(source.meta.title)}</h1><p class="lead">${escape(source.meta.description)}</p><div class="metadata"><span>${escape(t.updated)} <time datetime="${escape(source.meta.updated)}">${escape(source.meta.updated)}</time></span><span>${escape(t.edition)}: ${escape(source.meta.edition)}</span></div></header><div class="article-layout"><nav class="toc" aria-label="${escape(t.toc)}"><span class="eyebrow">${escape(t.toc)}</span>${rendered.headings.filter(h => h.level === 2).map(h => `<a href="#${h.id}" lang="${actualLang}">${escape(h.text)}</a>`).join('')}</nav><article class="prose" lang="${actualLang}">${rendered.html}</article></div>`;
      const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(source.meta.title)} · ${config.name}</title><meta name="description" content="${escape(source.meta.description)}"><meta name="theme-color" content="#f7f5ed"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/comparison.css"><link rel="stylesheet" href="/trending.css"></head><body><a class="skip" href="#main">${lang === 'it' ? 'Vai al contenuto' : 'Skip to content'}</a><header class="site-header"><a class="brand" href="/${lang}/" aria-label="Ranma one half Index home">RANMA <span>½</span><small>INDEX</small></a><nav class="top-nav" aria-label="${lang === 'it' ? 'Navigazione principale' : 'Main navigation'}"><a href="/${lang}/#guides">${escape(t.resources)}</a><details class="languages"><summary>${languageName(lang)} <span aria-hidden="true">⌄</span><span class="sr-only"> · ${escape(t.language)}</span></summary><div>${languageLinks}</div></details></nav></header><main id="main">${warning}${content}</main><footer><a class="footer-brand" href="/${lang}/">RANMA ½ INDEX</a><p>${escape(t.footer)}<span class="footer-credit">${lang === 'it' ? 'Creato da' : 'Created by'} <a href="https://x.com/forketta95">@forketta95</a></span></p><a href="https://github.com/ranma1-2/ranma1-2.github.io">GitHub ↗</a></footer></body></html>`;
      const destination = join(outDir, lang, page.path, 'index.html');
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, html);
    }
  }
  await writeFile(join(outDir, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ranma ½ Index</title><meta http-equiv="refresh" content="0;url=/en/"><a href="/en/">Continue in English</a> · <a href="/it/">Continua in italiano</a></html>');
  await writeFile(join(outDir, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · Ranma ½ Index</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/comparison.css"><link rel="stylesheet" href="/trending.css"><main class="error-page"><h1>404</h1><p>Page not found / Pagina non trovata</p><a class="button" href="/en/">English</a> <a class="button" href="/it/">Italiano</a></main></html>');
  await writeFile(join(outDir, '.nojekyll'), '');
  console.log(`Built ${config.pages.length * Object.keys(config.languages).length} pages in ${outDir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
