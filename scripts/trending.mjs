import { readFile } from 'node:fs/promises';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const messages = {
  it: {
    title: 'Anime Trending: storico dei risultati',
    description: 'Le posizioni settimanali di Ranma ½, dei personaggi e delle coppie nei sondaggi di Anime Trending.',
    category: 'SONDAGGI', open: 'Apri lo storico', season: 'Stagione', week: 'Settimana', entry: 'Voce', legend: '1° oro · 2° argento · 3° bronzo. Le celle vuote indicano dati non presenti nel file.',
    incomplete: 'I dati della settimana {week} della stagione {season} potrebbero essere incompleti: all’epoca non furono registrati tutti i risultati.',
    scroll: 'La tabella continua in orizzontale: scorri per vedere le altre stagioni.',
    unavailable: 'Celle scure: classifiche non previste. Personaggi e coppie iniziano dalla settimana 3.',
    notScheduled: 'Classifica non prevista prima della settimana {week}.',
    categories: { anime: 'ANIME', boys: 'PERSONAGGI MASCHILI', girls: 'PERSONAGGI FEMMINILI', ships: 'COPPIE / SHIP' },
  },
  en: {
    title: 'Anime Trending: results archive',
    description: 'Weekly rankings for Ranma ½, its characters and couples in the Anime Trending polls.',
    category: 'POLLS', open: 'Open the archive', season: 'Season', week: 'Week', entry: 'Entry', legend: '1st gold · 2nd silver · 3rd bronze. Blank cells indicate data not present in the file.',
    incomplete: 'Data for week {week} of season {season} may be incomplete: not all results were recorded at the time.',
    scroll: 'The table continues horizontally: scroll to see the other seasons.',
    unavailable: 'Dark cells: no rankings scheduled. Character and couple rankings start in week 3.',
    notScheduled: 'No ranking scheduled before week {week}.',
    categories: { anime: 'ANIME', boys: 'BOYS', girls: 'GIRLS', ships: 'COUPLES / SHIPS' },
  },
};

export function validateTrending(data) {
  for (const [category, start] of Object.entries(data.categoryStartWeeks || {})) {
    if (!data.categories.includes(category) || !Number.isInteger(start) || start < 1) throw new Error(`Invalid category start week: ${category}`);
  }
  const seasonIds = new Set();
  for (const season of data.seasons) {
    if (seasonIds.has(season.id)) throw new Error(`Duplicate season: ${season.id}`);
    seasonIds.add(season.id);
    if (!Number.isInteger(season.number) || season.number < 1 || !season.weeks.length || new Set(season.weeks).size !== season.weeks.length || season.weeks.some(week => !Number.isInteger(week) || week < 1)) throw new Error(`Invalid weeks or season: ${season.id}`);
    if ((season.incompleteWeeks || []).some(week => !season.weeks.includes(week))) throw new Error(`Incomplete week outside season: ${season.id}`);
  }
  const ids = new Set();
  for (const entry of data.entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate entry: ${entry.id}`);
    ids.add(entry.id);
    if (!data.categories.includes(entry.category)) throw new Error(`Unknown category: ${entry.category}`);
    for (const season of data.seasons) {
      const ranks = entry.positions[season.id];
      if (ranks === undefined) continue; // A newly added season may initially have no recorded data.
      if (!Array.isArray(ranks) || ranks.length !== season.weeks.length || ranks.some(rank => rank !== null && (!Number.isInteger(rank) || rank < 1))) throw new Error(`Invalid rankings: ${entry.id}/${season.id}`);
      if (ranks.some((rank, index) => rank !== null && season.weeks[index] < (data.categoryStartWeeks?.[entry.category] ?? 1))) throw new Error(`Ranking before category start week: ${entry.id}/${season.id}`);
    }
  }
}

export async function loadTrending(root) {
  const data = JSON.parse(await readFile(new URL('data/anime-trending.json', root), 'utf8'));
  validateTrending(data);
  return data;
}

export function rankClass(rank) {
  return rank === 1 ? ' rank-gold' : rank === 2 ? ' rank-silver' : rank === 3 ? ' rank-bronze' : '';
}

export function renderTrending(data, lang) {
  const t = messages[lang] || messages.en;
  const columns = data.seasons.reduce((total, season) => total + season.weeks.length, 1);
  const noteId = (season, week) => `trending-${season.id}-week-${week}-note`;
  const noteText = (season, week) => t.incomplete.replace('{week}', week).replace('{season}', season.number);
  const notes = data.seasons.flatMap(season => (season.incompleteWeeks || []).map(week => `<p class="trending-note" id="${escape(noteId(season, week))}"><strong>* ${escape(noteText(season, week))}</strong></p>`)).join('');
  const seasonHeader = data.seasons.map(season => `<th scope="colgroup" colspan="${season.weeks.length}" id="trending-${escape(season.id)}">${t.season} ${season.number}</th>`).join('');
  const weekHeader = data.seasons.map(season => season.weeks.map(week => {
    const incomplete = (season.incompleteWeeks || []).includes(week);
    return `<th scope="col" id="trending-${escape(season.id)}-week-${week}"${incomplete ? ` class="incomplete-week" aria-describedby="${escape(noteId(season, week))}"` : ''}><span class="sr-only">${t.season} ${season.number}, ${t.week} </span>${week}${incomplete ? ' *' : ''}</th>`;
  }).join('')).join('');
  const rows = data.categories.map(category => `<tbody><tr class="trending-category category-${escape(category)}"><th colspan="${columns}" scope="rowgroup"><span class="trending-category-label">${escape(t.categories[category] || category)}</span></th></tr>${data.entries.filter(entry => entry.category === category).map(entry => `<tr class="trending-entry" id="trending-${escape(entry.id)}"><th scope="row">${escape(entry.name)}</th>${data.seasons.map(season => season.weeks.map((week, index) => {
    const rank = entry.positions[season.id]?.[index] ?? null;
    const incomplete = (season.incompleteWeeks || []).includes(week);
    const firstWeek = data.categoryStartWeeks?.[category] ?? 1;
    if (week < firstWeek) {
      const description = t.notScheduled.replace('{week}', firstWeek);
      return `<td class="trending-rank rank-unavailable${index === 0 ? ' season-start' : ''}" headers="trending-${escape(season.id)} trending-${escape(season.id)}-week-${week}" title="${escape(description)}"><span class="sr-only">${escape(description)}</span></td>`;
    }
    return `<td class="trending-rank${rankClass(rank)}${index === 0 ? ' season-start' : ''}${incomplete ? ' incomplete-week' : ''}" headers="trending-${escape(season.id)} trending-${escape(season.id)}-week-${week}"${incomplete ? ` aria-describedby="${escape(noteId(season, week))}"` : ''}>${rank ?? ''}</td>`;
  }).join('')).join('')}</tr>`).join('')}</tbody>`).join('');
  return `<section class="trending-section" aria-label="${escape(t.title)}">${notes}<p class="trending-legend">${t.legend} ${t.unavailable}</p><p class="trending-scroll-hint">${t.scroll}</p><div class="trending-table-wrap" role="region" aria-label="${escape(t.title)}" tabindex="0"><table class="trending-table"><caption class="sr-only">${escape(t.description)}</caption><thead><tr><th rowspan="2" scope="col" class="entry-heading">${t.entry}</th>${seasonHeader}</tr><tr>${weekHeader}</tr></thead>${rows}</table></div></section>`;
}

export function trendingCard(lang) {
  const t = messages[lang] || messages.en;
  return `<a class="guide-card trending-card" href="/${lang}/anime-trending/"><div class="card-art trending-art" aria-hidden="true"><span class="trending-symbol">1 · 2 · 3</span><span class="art-number">03</span></div><div class="card-copy"><span class="eyebrow">${t.category}</span><h3>${t.title}</h3><p>${t.description}</p><span class="card-link">${t.open} <span>↗</span></span></div></a>`;
}
