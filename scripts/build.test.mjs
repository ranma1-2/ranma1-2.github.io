import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, root, markdown } from './build.mjs';

test('missing translations produce a real Italian URL with an English page and warning', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'ranma-fallback-'));
  const contentDir = join(fixture, 'content');
  const outDir = join(fixture, 'dist');
  await mkdir(contentDir);
  await cp(join(root, 'content/en'), join(contentDir, 'en'), { recursive: true });
  const source = await readFile(join(contentDir, 'en/voting.md'), 'utf8');
  await writeFile(join(contentDir, 'en/voting.md'), source + '\n\nEnglish fallback test marker.\n');
  await build({ contentDir, outDir });
  const html = await readFile(join(outDir, 'it/guides/voting/index.html'), 'utf8');
  assert.match(html, /Questa pagina non è ancora disponibile in italiano/);
  assert.match(html, /<article class="prose" lang="en">/);
  assert.match(html, /href="\/en\/guides\/voting\/"/);
  assert.match(html, /English fallback test marker/);
});

test('older translation revisions show the update warning', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'ranma-revision-'));
  const contentDir = join(fixture, 'content');
  await cp(join(root, 'content'), contentDir, { recursive: true });
  const source = await readFile(join(contentDir, 'en/voting.md'), 'utf8');
  await writeFile(join(contentDir, 'en/voting.md'), source.replace('revision: 1', 'revision: 2'));
  await build({ contentDir, outDir: join(fixture, 'dist') });
  const html = await readFile(join(fixture, 'dist/it/guides/voting/index.html'), 'utf8');
  assert.match(html, /Questa traduzione potrebbe non essere aggiornata/);
  assert.match(html, /<article class="prose" lang="it">/);
});

test('content escapes raw HTML and rejects unsafe link schemes', () => {
  const { html } = markdown('<script>alert(1)</script>\n\n[Link](javascript:evil)');
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
});
