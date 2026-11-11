"""Translate every UI string into every supported language once and cache it in the database.
Run after setting SARVAM_API_KEY:  python prewarm.py"""
import json
from app import db as D, translate as T
D.init_db()
en = json.load(open(D.BASE / "content" / "en.json", encoding="utf-8")); texts = list(en.values())
if not T.configured(): raise SystemExit("Set SARVAM_API_KEY in .env first.")
for l in D.load("languages.json"):
    if l["code"] != "en": print("Translating", l["name"], "..."); T.tr_many(texts, l["code"])
print("Done")
