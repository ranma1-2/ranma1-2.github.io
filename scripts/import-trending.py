"""One-time, read-only XLSX import. Website builds only need Node.js.
Usage: python scripts/import-trending.py "path/to/RANMA - AnimeTrending.xlsx"
Reimport overwrites data/anime-trending.json.
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
CATEGORY_IDS = {"ANIME": "anime", "BOYS": "boys", "GIRLS": "girls", "SHIP": "ships"}


def run(path):
    workbook = openpyxl.load_workbook(path, data_only=True)
    sheet = workbook.worksheets[0]
    seasons = []
    for cell in sheet[1]:
        if cell.value and re.fullmatch(r"S\d+", str(cell.value)):
            number = int(str(cell.value)[1:])
            columns = next(item for item in sheet.merged_cells.ranges if item.min_row == 1 and item.min_col == cell.column)
            weeks = [int(sheet.cell(2, column).value) for column in range(columns.min_col, columns.max_col + 1)]
            seasons.append({"id": f"s{number}", "number": number, "weeks": weeks,
                            "incompleteWeeks": [11] if number == 2 else [],
                            "_columns": list(range(columns.min_col, columns.max_col + 1))})
    entries = []
    category = None
    for row in sheet.iter_rows(min_row=3):
        name = row[0].value
        if name is None:
            continue
        if name in CATEGORY_IDS:
            category = CATEGORY_IDS[name]
            continue
        if category is None:
            raise ValueError(f"Missing category at {row[0].coordinate}")
        slug = re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")
        positions = {}
        for season in seasons:
            values = [sheet.cell(row[0].row, column).value for column in season['_columns']]
            if any(value is not None and (not isinstance(value, (float, int)) or value < 1 or int(value) != value) for value in values):
                raise ValueError(f"Invalid rank at row {row[0].row}")
            positions[season['id']] = [None if value is None else int(value) for value in values]
        entries.append({"id": f"{category}-{slug}", "category": category, "name": str(name),
                        "positions": positions, "sourceRow": row[0].row})
    for season in seasons:
        del season['_columns']
    data = {"schemaVersion": 1, "source": {"workbook": Path(path).name, "sheet": sheet.title},
            "categoryStartWeeks": {"anime": 1, "boys": 3, "girls": 3, "ships": 3},
            "seasons": seasons, "categories": list(CATEGORY_IDS.values()), "entries": entries}
    (ROOT / 'data/anime-trending.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({"seasons": len(seasons), "entries": len(entries),
                      "recordedRanks": sum(rank is not None for entry in entries for ranks in entry['positions'].values() for rank in ranks)}))


if __name__ == '__main__':
    run(sys.argv[1])
