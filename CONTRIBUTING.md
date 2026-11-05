# Contributing to Ranma ½ Index

Contributions to content, translations, reference data and the site itself are
welcome. English is the base language. Keep repository documentation, code
comments and pull request descriptions in English; translated site content belongs
in the corresponding language files.

## 1. Check whether your language is supported

Check the language selector on the site or the `languages` setting in
[`site.config.mjs`](site.config.mjs).

- **Your language is listed:** use its existing files. You can translate missing
  pages, improve translations or correct the content.
- **Your language is missing:** open an issue requesting it. Include the language
  name, its locale code if known, and whether you can help translate it.
- **You want to add the language yourself:** follow the steps below and submit a
  pull request. You do not need to wait for a language request to be implemented.

### Adding a language

Use a consistent locale code, such as `fr`, in configuration, folder names and
translation files.

1. Add the code and the language's native name to `languages` in
   [`site.config.mjs`](site.config.mjs). An entry in `languageFlags` is optional;
   if you add a flag, place its asset in `public/images/flags/`.
2. Add interface translations to the `copy` object in
   [`scripts/build.mjs`](scripts/build.mjs). Also translate language-dependent
   inline labels in that template, such as the skip link and creator credit.
3. Create `content/<locale>/` and translate the English Markdown pages you want
   to provide. Keep the same filenames and metadata fields. Pages without a
   translation are generated from English with a fallback notice.
4. Add the locale to the `messages` objects in
   [`scripts/comparison.mjs`](scripts/comparison.mjs) and
   [`scripts/trending.mjs`](scripts/trending.mjs), which contain the table labels,
   legends and notices.
5. For manga–anime titles and notes, create `data/translations/<locale>.json`
   using the keys from [`data/translations/en.json`](data/translations/en.json).
   Update `loadComparison()` in `scripts/comparison.mjs` to load that file and
   include it in the returned `translations` map. Fields not yet translated
   should fall back to English with the existing notice.
6. Run the checks below. Verify the language selector on each page, URLs with the
   locale prefix, table labels and notices, and the fallback for a missing page.

Adding a configuration entry alone is not enough: the shared interface and table
renderers need the corresponding translations and loading support too. A first
contribution can translate part of the content, provided the interface works and
the English fallback remains available.

## 2. Run the project locally

Fork the repository, clone your fork and create a branch for your change. From
the project directory, use Node.js 22 or later:

```sh
npm run dev
```

There are no npm dependencies to install. Open
<http://127.0.0.1:4173/en/> and refresh the browser after saving a change. The
local server rebuilds the pages on each request. Stop it with Ctrl+C.

Python and `openpyxl` are only needed for the optional spreadsheet import
scripts, not for editing JSON, running tests or building the site.

## 3. Edit the source files

| Change | Location |
| --- | --- |
| Page text and metadata | `content/<locale>/*.md` |
| Manga–anime chapters, episodes and adaptation information | `data/manga-anime.json` |
| Manga–anime titles, recommendations and notes | `data/translations/<locale>.json` |
| Anime Trending rankings and seasons | `data/anime-trending.json` |
| Images and other public assets | `public/` |
| Shared page layout and interface text | `scripts/build.mjs` |
| Comparison table layout and interface text | `scripts/comparison.mjs` |
| Anime Trending table layout and interface text | `scripts/trending.mjs` |
| Styles | `public/styles.css`, `public/comparison.css`, `public/trending.css` |

Generated files in `dist/` are excluded from Git. Edit their source files instead.
Keep the tables simple and preserve existing IDs and page paths so shared links
continue to work.

### Markdown pages and translations

Each page starts with a metadata block containing `title`, `description`,
`revision`, `updated` and `edition`. Keep every field on a single line; dates use
`YYYY-MM-DD`, and `revision` is an integer.

The renderer supports headings from `#` to `###`, paragraphs, `-` bullet lists,
`>` notes, links, images, `**bold**` text and inline code. Leave blank lines
between blocks. Raw HTML and other Markdown features, including Markdown tables
and automatic numbered lists, are not supported.

English pages must exist. Keep translation revisions aligned with the English
revision they translate. When an English content change makes existing
translations outdated, increase its revision; update a translation's revision
after bringing its content up to date. Missing pages use English with a notice;
older revisions show an update notice.

Place screenshots in `public/images/` and reference them as
`![Description](/images/filename.png)`. Write useful alternative text in the
page's language. Include source links for factual corrections, poll instructions
or new reference data so the maintainer can review them.

### Manga–anime comparison data

Keep chapter and episode numbers in the common JSON, and translated titles and
notes in the locale files. Use separate references for non-consecutive episodes;
for example, episodes 24 and 26 are not the range 24–26.

Preserve distinctions between adaptation, reused content in a different context,
inspired stories and predictions. Empty reference lists mean that the source
does not specify a reference; they do not automatically mean “not adapted.”
Chapter-level details are retained in the JSON even though the simple table only
shows the main comparison.

### Anime Trending results

Each season defines its `weeks`; each entry's `positions` array follows that
order. Use positive integers for recorded ranks and `null` for missing values.
Positions 1, 2 and 3 automatically receive gold, silver and bronze backgrounds.

`categoryStartWeeks` defines when a category begins. Currently, anime rankings
start in week 1, and character and couple rankings start in week 3. Earlier cells
are shaded automatically and must not contain recorded ranks.

Add a season to `seasons` to extend the table horizontally. Its position arrays,
when present, must have the same length as its `weeks` array. An omitted season
array initially renders as blank cells.

Season 2, week 11 is marked in `incompleteWeeks` because the historical record may
be incomplete. Preserve that notice unless you can supply the missing results
and establish that the record is complete.

### Spreadsheet import helpers

The optional `scripts/import-arcs.py`, `scripts/import-trending.py` and
`scripts/translate-arcs.mjs` helpers overwrite JSON or translation files. Avoid
rerunning them over manual edits without comparing the changes. The original
spreadsheets are not required to build or publish the site.

## 4. Check your changes

Run these commands before opening the pull request:

```sh
npm test
npm run build
```

For visual changes, check the affected pages in the browser, including a narrow
window. For translations, check both translated content and the English fallback.

Some tests assert the original imported counts or specific recorded values. If
your contribution legitimately changes those data, update the relevant assertions
and explain the correction in the pull request. Preserve checks for missing data,
translation fallback and automatic table behavior.

## 5. Open a pull request

Open a pull request from your branch to this repository's `main` branch. Describe
what changed, which pages or languages are affected, any supporting sources, and
the checks you ran. Include a screenshot for a layout change when useful.

The maintainer reviews the changes and may request adjustments before merging.
The existing publishing workflow runs tests and builds the site after a push to
`main`; a successful run publishes the merged content through GitHub Pages.
