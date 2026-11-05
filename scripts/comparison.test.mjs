import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComparison, renderComparison, validateComparison } from './comparison.mjs';

const bundle = await loadComparison(new URL('../', import.meta.url));
const byId = id => bundle.data.entries.find(entry => entry.id === id);

test('all spreadsheet rows and chapter notes are preserved, with complete Italian translations', () => {
  assert.equal(bundle.data.entries.length, 120);
  assert.equal(bundle.data.chapterDetails.length, 407);
  assert.equal(Object.keys(bundle.translations.en.chapterNotes).length, 64);
  const covered = bundle.data.entries.flatMap(entry => Array.from({ length: entry.chapters.to - entry.chapters.from + 1 }, (_, n) => entry.chapters.from + n));
  assert.deepEqual(covered, Array.from({ length: 407 }, (_, n) => n + 1));
  for (const [id, text] of Object.entries(bundle.translations.en.entries)) {
    for (const key of Object.keys(text)) assert.ok(bundle.translations.it.entries[id]?.[key], `${id}.${key}`);
  }
  for (const key of Object.keys(bundle.translations.en.chapterNotes)) assert.ok(bundle.translations.it.chapterNotes[key], key);
});

test('chapter dates, separated episodes, special media and context are interpreted correctly', () => {
  assert.deepEqual(bundle.data.entries[0].chapters, { from: 1, to: 2 });
  assert.deepEqual(bundle.data.entries[1].chapters, { from: 3, to: 9 });
  assert.deepEqual(byId('chapters-041-043').anime['1989'].references.map(ref => ref.from), [24, 26]);
  assert.equal(byId('chapters-056-058').anime['1989'].references[1].context, 'recontextualized');
  assert.equal(byId('chapters-059-062').anime['1989'].references[0].context, 'inspired');
  assert.equal(byId('chapters-230-233').anime['1989'].references[0].kind, 'ova');
  assert.equal(byId('chapters-301-302').anime['1989'].references[0].kind, 'movie');
  assert.equal(byId('chapters-074-077').anime['2024'].prediction, true);
  assert.equal(bundle.data.entries.filter(entry => entry.anime['2024'].prediction).length, 1);
});

test('the simple table preserves all seven columns, rows and original notation', () => {
  const { html } = renderComparison(bundle, 'en');
  assert.equal((html.match(/class="comparison-row"/g) || []).length, 120);
  assert.equal((html.match(/<th scope="col">/g) || []).length, 7);
  assert.match(html, /<th scope="col">ID<\/th>/);
  assert.match(html, /<th scope="col">Mandatory\?<\/th>/);
  assert.match(html, /<em>22<\/em>/);
  assert.match(html, /24, 26 \(\*\)/);
  assert.match(html, /&quot;130&quot;/);
  assert.doesNotMatch(html, /<form|<script|chapter-details|prediction-badge|comparison-stats/);
});

test('missing translated fields fall back to English with a visible language notice', () => {
  const fixture = structuredClone(bundle);
  delete fixture.translations.it.entries['chapters-001-002'].title;
  delete fixture.translations.it.entries['chapters-065-065'].recommendation;
  const { html } = renderComparison(fixture, 'it');
  assert.match(html, /lang="en">Introduction Arc/);
  assert.match(html, /Testo disponibile in inglese/);
  assert.match(html, /lang="en">You can read ch65 or watch OG ep40/);
});

test('duplicate IDs fail validation and translated HTML is escaped', () => {
  const fixture = structuredClone(bundle);
  fixture.data.entries.push(fixture.data.entries[0]);
  assert.throws(() => validateComparison(fixture.data, fixture.translations.en), /Duplicate comparison ID/);
  fixture.data.entries.pop();
  fixture.translations.it.entries['chapters-001-002'].title = '</script><script>alert(1)</script>';
  const { html } = renderComparison(fixture, 'it');
  assert.doesNotMatch(html, /<script>alert\(1\)/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
