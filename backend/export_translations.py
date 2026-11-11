"""Save every translation cached in your local database into data/translations_seed.json.
Commit that file so a freshly hosted server starts with the languages already translated (no Gemini calls needed).
Run after you have switched through the languages you want:  python export_translations.py"""
import json
from app import db as D
c = D.conn(); rows = [[r["k"], r["text"]] for r in c.execute("select k,text from translations")]
json.dump(rows, open(D.DATA / "translations_seed.json", "w", encoding="utf-8"), ensure_ascii=False)
print(len(rows), "translations saved to data/translations_seed.json")
