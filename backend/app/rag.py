import json
from sklearn.feature_extraction.text import TfidfVectorizer
from . import db as D
DOCS = []; VEC = None; MAT = None
def build():
    global DOCS, VEC, MAT
    c = D.conn(); DOCS = []
    for r in D.rows(c, "select data from loans"):
        l = json.loads(r["data"])
        DOCS.append(dict(id=l["id"], type="loan", topic="loans", title=l["name"], text=f"Loan: {l['name']} (segment {l['segment']}). {l['summary']} Eligibility: {'; '.join(l['eligibility'])}. Terms and conditions: {'; '.join(l['terms'])}. Interest sample {l['rate_range_pct']} percent, up to {l['max_amount_inr']} rupees. Documents needed: {'; '.join(l['documents'])}. How to apply: {'; '.join(l['how_to_apply'])}. {l['note']}"))
    for r in D.rows(c, "select data from services"):
        s = json.loads(r["data"])
        DOCS.append(dict(id=s["id"], type="service", topic=s["category"], title=s["name"], text=f"Service: {s['name']} (category {s['category']}). {s['description']} How it works: {s['how_it_works']} Where: {s['channel'].replace('_', ' ')}. You need: {', '.join(s['documents']) or 'nothing special'}. Steps: {'; '.join(s['steps'])}."))
    c.close()
    VEC = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", sublinear_tf=True); MAT = VEC.fit_transform([d["title"] + " " + d["text"] for d in DOCS])
def search(q, k=4):
    if not DOCS or not q.strip(): return []
    s = (MAT @ VEC.transform([q]).T).toarray().ravel()
    return [dict(DOCS[i], score=round(float(s[i]), 3)) for i in s.argsort()[::-1][:k] if s[i] > 0.03]
