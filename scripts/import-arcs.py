"""Read the original workbook without changing it; create editable website JSON.

Usage: python scripts/import-arcs.py "path/to/workbook.xlsx"
Requires openpyxl only for this optional, one-time import. Website builds use Node.
Reimporting overwrites the common data and English text, not Italian translations.
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
COLORS = {"B6D7A8": 1, "4A86E8": 2, "FF9900": 3, "EA9999": 4,
          "A64D79": 5, "F1C232": 6, "E06666": 7, "D0E0E3": "special"}


def text(value):
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return str(int(value))
    return str(value).strip()


def references(value):
    raw = text(value)
    kind = "ova" if re.match(r"O[VA]{2}", raw, re.I) else "movie" if raw.lower().startswith("movie") else "episode"
    body = re.split(r"\(|except|with", raw, maxsplit=1, flags=re.I)[0]
    result = []
    for match in re.finditer(r'("?)(\d+)(?:\s*-\s*(\d+))?("?)', body):
        context = "recontextualized" if match[1] or match[4] else "inspired" if raw.lower().startswith("inspired") else "adaptation"
        result.append({"kind": kind, "from": int(match[2]), "to": int(match[3] or match[2]), "context": context})
    return result


def adaptation(cell, entry_text, key):
    raw = text(cell.value)
    color = cell.fill.fgColor
    season = COLORS.get(str(color.rgb)[-6:]) if color.type == "rgb" else None
    annotation = ""
    if "aired after ep27" in raw:
        annotation = "Originally aired after episode 27."
    elif "except c. 119" in raw:
        annotation = "Chapter 119 is excluded."
    elif "with lot of skips" in raw:
        annotation = "Many parts are omitted."
    elif "with some skips" in raw:
        annotation = "Some parts are omitted."
    elif "with some differences" in raw:
        annotation = "There are some differences from the manga."
    if annotation:
        entry_text[key] = annotation
    return {"references": references(cell.value), "season": season,
            "prediction": bool(raw and cell.font.i),
            "hasDifferences": "(*)" in raw or "differences" in raw,
            "sourceLabel": raw}


def run(path):
    workbook = openpyxl.load_workbook(path, rich_text=True)
    sheet = workbook["Adaptation Table"]
    entries, translations, restored = [], {}, []
    for cells in sheet.iter_rows(min_row=4, max_col=7):
        number, title, importance, chapters, old, new, recommendation = cells
        if not title.value or not chapters.value:
            continue
        if isinstance(chapters.value, datetime):
            chapter_label = f"{chapters.value.day}-{chapters.value.month}"
            restored.append({"cell": chapters.coordinate, "restored": chapter_label, "numberFormat": chapters.number_format})
        else:
            chapter_label = text(chapters.value)
        match = re.fullmatch(r"(\d+)(?:-(\d+))?", chapter_label)
        if not match:
            raise ValueError(f"Unrecognized chapters at {chapters.coordinate}: {chapter_label}")
        start, end = int(match[1]), int(match[2] or match[1])
        entry_id = f"chapters-{start:03d}-{end:03d}"
        localized = {"title": text(title.value)}
        if recommendation.value:
            localized["recommendation"] = text(recommendation.value)
        entry = {"id": entry_id, "order": len(entries) + 1,
                 "arcNumber": int(number.value) if number.value else None,
                 "chapters": {"from": start, "to": end},
                 "importance": re.findall(r"START|ENDING|NC|NT|FM|Q|R", text(importance.value)),
                 "anime": {"1989": adaptation(old, localized, "anime1989Note"),
                           "2024": adaptation(new, localized, "anime2024Note")},
                 "sourceRow": title.row}
        entries.append(entry)
        translations[entry_id] = localized
    chapters, notes = [], {}
    detail = workbook["WIP In Deep"]
    for row in detail.iter_rows(min_row=2, max_col=6):
        if not isinstance(row[1].value, (int, float)):
            continue
        chapter = int(row[1].value)
        record = {"chapter": chapter, "anime": {}}
        for year, cell, note in [("1989", row[2], row[3]), ("2024", row[4], row[5])]:
            record["anime"][year] = {"references": references(cell.value)}
            if note.value:
                note_id = f"{chapter}-{year}"
                record["anime"][year]["noteId"] = note_id
                notes[note_id] = text(note.value)
        chapters.append(record)
    output = ROOT / "data"
    (output / "translations").mkdir(parents=True, exist_ok=True)
    data = {"schemaVersion": 1, "source": {"workbook": Path(path).name,
            "sheets": ["Adaptation Table", "WIP In Deep"],
            "restoredChapterRanges": restored}, "entries": entries, "chapterDetails": chapters}
    for destination, value in [(output / "manga-anime.json", data),
                                (output / "translations/en.json", {"entries": translations, "chapterNotes": notes})]:
        destination.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"entries": len(entries), "chapters": len(chapters), "notes": len(notes), "restored": restored}))


if __name__ == "__main__":
    run(sys.argv[1])
