import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTrending, renderTrending, rankClass, validateTrending } from './trending.mjs';

const data = await loadTrending(new URL('../', import.meta.url));

test('recorded positions render in the corresponding season and week', () => {
  const html = renderTrending(data, 'en');
  for (const entry of data.entries) {
    const row = html.split(`id="trending-${entry.id}">`)[1]?.split('</tr>')[0];
    assert.ok(row, `Missing row for ${entry.id}`);
    for (const season of data.seasons) {
      for (const [index, week] of season.weeks.entries()) {
        const rank = entry.positions[season.id]?.[index];
        if (rank == null) continue;
        const headers = `headers="trending-${season.id} trending-${season.id}-week-${week}"`;
        const cell = row.split(headers)[1]?.split('</td>')[0];
        assert.equal(cell?.split('>').at(-1), String(rank), `${entry.id}, ${season.id}, week ${week}`);
      }
    }
  }
});

test('rank colors follow numbers and blank cells stay empty', () => {
  assert.equal(rankClass(1), ' rank-gold');
  assert.equal(rankClass(2), ' rank-silver');
  assert.equal(rankClass(3), ' rank-bronze');
  assert.equal(rankClass(4), '');
  assert.equal(rankClass(null), '');
  const html = renderTrending(data, 'it');
  const ranks = data.entries.flatMap(entry => Object.values(entry.positions).flat());
  for (const [rank, color] of [[1, 'gold'], [2, 'silver'], [3, 'bronze']]) {
    assert.equal((html.match(new RegExp(`class="trending-rank rank-${color}`, 'g')) || []).length, ranks.filter(value => value === rank).length);
  }
  assert.doesNotMatch(html, />null<|>undefined<|>0<|<script|<form/);
  assert.equal((html.match(/class="trending-entry"/g) || []).length, data.entries.length);
});

test('season 2 week 11 is explicitly marked incomplete in both languages without changing recorded results', () => {
  assert.deepEqual(data.seasons[1].incompleteWeeks, [11]);
  for (const [lang, phrase] of [['it', 'potrebbero essere incompleti'], ['en', 'may be incomplete']]) {
    const html = renderTrending(data, lang);
    assert.ok(html.includes(phrase));
    assert.match(html, /id="trending-s2-week-11" class="incomplete-week"/);
    assert.match(html, /aria-describedby="trending-s2-week-11-note"/);
  }
  assert.equal(data.entries.find(entry => entry.name === 'Ryoga Hibiki').positions.s2[10], null);
});

test('character and couple rankings start in week 3 in every season, without hiding recorded anime positions', () => {
  const html = renderTrending(data, 'it');
  const inactiveCount = data.entries.filter(entry => entry.category !== 'anime').length * data.seasons.length * 2;
  assert.equal((html.match(/class="trending-rank rank-unavailable/g) || []).length, inactiveCount);
  const animeRow = html.match(/id="trending-anime-ranma">([\s\S]*?)<\/tr>/)[1];
  assert.doesNotMatch(animeRow, /rank-unavailable/);
  assert.match(html, /Classifica non prevista prima della settimana 3/);
  assert.match(renderTrending(data, 'en'), /No ranking scheduled before week 3/);
  const invalid = structuredClone(data);
  invalid.entries.find(entry => entry.category === 'boys').positions.s1[0] = 1;
  assert.throws(() => validateTrending(invalid), /Ranking before category start week/);
});

test('a new season automatically extends the column groups and every result row', () => {
  const extended = structuredClone(data);
  extended.seasons.push({ id: 's4', number: 4, weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], incompleteWeeks: [] });
  extended.entries[0].positions.s4 = [3, 2, 1, null, null, null, null, null, null, null, null];
  validateTrending(extended);
  const html = renderTrending(extended, 'it');
  assert.match(html, /colspan="11" id="trending-s4">Stagione 4/);
  assert.match(html, /id="trending-s4-week-11"/);
  assert.match(html, /colspan="45" scope="rowgroup"/);
  assert.equal((html.match(/headers="trending-s4 /g) || []).length, extended.entries.length * 11);
});

test('invalid ranks are rejected and names are escaped', () => {
  const invalid = structuredClone(data);
  invalid.entries[0].positions.s1[0] = 0;
  assert.throws(() => validateTrending(invalid), /Invalid rankings/);
  const changed = structuredClone(data);
  changed.entries[0].name = '<script>alert(1)</script>';
  assert.doesNotMatch(renderTrending(changed, 'en'), /<script>/);
});
