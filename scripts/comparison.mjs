import { readFile } from 'node:fs/promises';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const messages = {
  it: {
    title: 'Manga e anime a confronto', description: 'Archi narrativi, capitoli ed episodi delle serie del 1989 e del 2024.',
    category: 'CONFRONTO', open: 'Apri il confronto',
    arc: 'Arco narrativo', importance: 'Importante?', manga: 'Capitoli', old: 'Episodi 1989', current: 'Episodi 2024', notes: 'Cosa fare?',
    purpose: 'Se segui il nuovo anime e vuoi leggere il manga solo per le parti saltate, trovi i suggerimenti nell’ultima colonna.',
    legend: 'Legenda', season: 'Stagione', special: 'OVA e film', fallback: 'Testo disponibile in inglese', inspired: 'Ispirato all’episodio', movie: 'Film',
    context: '"xxx": l’episodio riprende informazioni o contenuti del manga in un contesto diverso.',
    star: '(*): ci sono differenze da segnalare. Note in lavorazione.',
    forecast: 'Gli episodi in corsivo sono previsioni: non erano ancora trasmessi o annunciati nel foglio originale.',
    codes: { START: 'Inizio', NC: 'Nuovo personaggio ricorrente', NT: 'Nuova tecnica marziale usata in altre storie', FM: 'Primo incontro tra due personaggi', Q: 'Richiamato in un altro arco', R: 'Risoluzione di una situazione', ENDING: 'Finale' },
  },
  en: {
    title: 'Manga & anime comparison', description: 'Story arcs, manga chapters and episodes from the 1989 and 2024 series.',
    category: 'COMPARISON', open: 'Open the comparison',
    arc: 'Story arc', importance: 'Mandatory?', manga: 'Chapters', old: '1989 EPs', current: '2024 EPs', notes: 'What to do?',
    purpose: 'If you are watching the new anime and want to read the manga only for the skipped parts, see the suggestions in the last column.',
    legend: 'Legend', season: 'Season', special: 'OVAs & movies', fallback: 'Text available in English', inspired: 'Inspired episode', movie: 'Movie',
    context: '"xxx": the episode reuses manga information or content in a different context.',
    star: '(*): there are differences worth noting. Notes in progress.',
    forecast: 'Italicized episodes are predictions: they had not aired or been announced in the original spreadsheet.',
    codes: { START: 'Beginning', NC: 'New recurring character', NT: 'New martial arts technique used in other stories', FM: 'First meeting between two characters', Q: 'Referenced in another story arc', R: 'Resolution of a situation', ENDING: 'Ending' },
  },
};

export function validateComparison(data, english) {
  const ids = new Set();
  for (const entry of data.entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate comparison ID: ${entry.id}`);
    ids.add(entry.id);
    if (!english.entries[entry.id]?.title) throw new Error(`Missing English title: ${entry.id}`);
    if (entry.chapters.from < 1 || entry.chapters.to < entry.chapters.from) throw new Error(`Invalid chapter range: ${entry.id}`);
    for (const code of entry.importance) if (!messages.en.codes[code]) throw new Error(`Unknown importance code: ${code}`);
    for (const anime of Object.values(entry.anime)) {
      if (![null, 1, 2, 3, 4, 5, 6, 7, 'special'].includes(anime.season)) throw new Error(`Unknown season: ${entry.id}`);
      for (const ref of anime.references) {
        if (!['episode', 'ova', 'movie'].includes(ref.kind) || !['adaptation', 'inspired', 'recontextualized'].includes(ref.context) || ref.from < 1 || ref.to < ref.from) throw new Error(`Invalid anime reference: ${entry.id}`);
      }
    }
  }
  for (const chapter of data.chapterDetails) for (const anime of Object.values(chapter.anime)) {
    if (anime.noteId && !english.chapterNotes[anime.noteId]) throw new Error(`Missing English chapter note: ${anime.noteId}`);
  }
}

export async function loadComparison(root) {
  const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const data = await read('data/manga-anime.json');
  const english = await read('data/translations/en.json');
  let italian;
  try { italian = await read('data/translations/it.json'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; italian = { entries: {}, chapterNotes: {} }; }
  validateComparison(data, english);
  return { data, translations: { en: english, it: italian } };
}



const range = ref => ref.from === ref.to ? String(ref.from) : `${ref.from}-${ref.to}`;

export function renderComparison(bundle, lang) {
  const { data, translations } = bundle;
  const t = messages[lang] || messages.en;
  const local = translations[lang] || { entries: {} };
  const english = translations.en;
  const localized = (translated, original) => translated ? escape(translated) : original ? `<span lang="en">${escape(original)}</span>${lang === 'en' ? '' : `<small class="translation-fallback">${t.fallback}</small>`}` : '';
  const seasonLabel = value => value === 'special' ? t.special : `${t.season} ${value}`;
  const rows = data.entries.map(entry => {
    const text = local.entries[entry.id] || {};
    const base = english.entries[entry.id];
    const animeCells = ['1989', '2024'].map(year => {
      const anime = entry.anime[year];
      const references = anime.references.map(ref => {
        let label = `${ref.kind === 'ova' ? 'OVA ' : ref.kind === 'movie' ? `${t.movie} ` : ''}${range(ref)}`;
        if (ref.context === 'recontextualized') label = `"${label}"`;
        if (ref.context === 'inspired') label = `${t.inspired} ${label}`;
        return escape(label);
      }).join(', ');
      const note = base[`anime${year}Note`] ? ` (${localized(text[`anime${year}Note`], base[`anime${year}Note`])})` : '';
      const marker = anime.hasDifferences && (anime.sourceLabel.includes('(*)') || !note) ? ' (*)' : '';
      const label = `${references}${marker}${note}`;
      const seasonClass = anime.references.length && anime.season !== null ? ` season-${anime.season}` : '';
      return `<td class="adaptation-cell${seasonClass}"${seasonClass ? ` title="${escape(seasonLabel(anime.season))}"` : ''}>${anime.prediction && references ? `<em>${label}</em>` : label}</td>`;
    }).join('');
    return `<tr id="${entry.id}" class="comparison-row"><td class="arc-id">${entry.arcNumber ?? ''}</td><th scope="row">${localized(text.title, base.title)}</th><td class="importance-cell${entry.importance.length ? ' has-importance' : ''}">${entry.importance.map(code => `<abbr title="${escape(t.codes[code])}">${code}</abbr>`).join(' + ')}</td><td class="chapter-range">${range(entry.chapters)}</td>${animeCells}<td class="arc-notes">${localized(text.recommendation, base.recommendation)}</td></tr>`;
  }).join('\n');
  const legend = `<details class="comparison-legend"><summary>${t.legend}</summary><div class="legend-content"><div class="season-legend">${[1, 2, 3, 4, 5, 6, 7, 'special'].map(season => `<span class="season-${season}">${seasonLabel(season)}</span>`).join('')}</div><dl class="importance-legend">${Object.entries(t.codes).map(([code, label]) => `<div><dt>${code}</dt><dd>${label}</dd></div>`).join('')}</dl><div class="legend-notes"><p>${escape(t.context)}</p><p>${escape(t.star)}</p><p>${escape(t.forecast)}</p></div></div></details>`;
  const html = `<section class="comparison-section" aria-label="${escape(t.title)}"><p class="comparison-purpose">${t.purpose}</p>${legend}<div class="comparison-table-wrap" role="region" aria-label="${escape(t.title)}" tabindex="0"><table class="comparison-table"><caption class="sr-only">${escape(t.description)}</caption><thead><tr>${['ID', t.arc, t.importance, t.manga, t.old, t.current, t.notes].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  return { html, title: t.title, description: t.description, category: t.category, open: t.open };
}

export function comparisonCard(lang) {
  const t = messages[lang] || messages.en;
  return `<a class="guide-card comparison-card" href="/${lang}/manga-anime/"><div class="card-art comparison-art" aria-hidden="true"><span class="comparison-symbol">M ↔ A</span><span class="art-number">02</span></div><div class="card-copy"><span class="eyebrow">${t.category}</span><h3>${t.title}</h3><p>${t.description}</p><span class="card-link">${t.open} <span>↗</span></span></div></a>`;
}
