import os, json, time, hashlib, httpx
from concurrent.futures import ThreadPoolExecutor
from . import db as D, gem
LANGS = D.load("languages.json")
RTL = {"ur", "ks", "sd"}
GOOGLE = {"hi": "hi", "bn": "bn", "mr": "mr", "te": "te", "ta": "ta", "gu": "gu", "ur": "ur", "kn": "kn", "or": "or", "ml": "ml", "pa": "pa", "as": "as", "mai": "mai", "ne": "ne", "sd": "sd", "kok": "gom", "doi": "doi", "mni": "mni-mtei", "sa": "sa"}
_off = {"until": 0.0}   # circuit breaker: stop calling a provider that is failing
def _k(lang, t): return hashlib.sha1(f"{lang}|{t}".encode()).hexdigest()
def provider(): return os.getenv("TRANSLATE_PROVIDER", "gemini").lower()
def configured():
    p = provider()
    return p == "google" or (p == "gemini" and bool(os.getenv("GEMINI_API_KEY"))) or (p == "sarvam" and bool(os.getenv("SARVAM_API_KEY")))
def _trip(why, secs):
    if time.time() >= _off["until"]: print(f"[translate] pausing translation for {secs}s: {why}")
    _off["until"] = time.time() + secs
def _name(lang): return next((l["name"] for l in LANGS if l["code"] == lang), lang)
def _gemini_batch(texts, lang):
    """Translate a list of strings in one request. Returns a list of the same length, or None."""
    if time.time() < _off["until"]: return None
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    prompt = (f"Translate each English string in this JSON array into {_name(lang)} as used in India, in simple everyday words that a bank customer with little formal education can understand. "
              "Keep these unchanged: StepFI, KYC, PAN, Aadhaar, UPI, OTP, EMI, NEFT, RTGS, IMPS, PDF, SMS, GST, FD, RD, numbers, rupee amounts and punctuation. "
              f"Return a JSON array of exactly {len(texts)} strings in the same order.\n\n" + json.dumps(texts, ensure_ascii=False))
    cfg = types.GenerateContentConfig(response_mime_type="application/json", response_schema=list[str], max_output_tokens=8192)
    for _ in range(2):
        try:
            r = gem.call(lambda m: client.models.generate_content(model=m, contents=prompt, config=cfg), os.getenv("GEMINI_TRANSLATE_MODEL"))
            out = json.loads(r.text)
            if isinstance(out, list) and len(out) == len(texts) and all(isinstance(x, str) for x in out): return out
            print("[translate] gemini returned a wrong shape, retrying")
        except Exception as e:
            print("[translate] gemini:", str(e)[:160])
            _trip("Gemini is busy, try again shortly" if gem.is_transient(e) else "Gemini translation error (check key and model)", 30 if gem.is_transient(e) else 300); return None
    return None
def _one(text, lang):
    if time.time() < _off["until"]: return None
    try:
        if provider() == "google":
            code = GOOGLE.get(lang)
            if not code: return None
            from deep_translator import GoogleTranslator
            return GoogleTranslator(source="en", target=code).translate(text)
        code = next(l["sarvam"] for l in LANGS if l["code"] == lang)
        r = httpx.post("https://api.sarvam.ai/translate", headers={"api-subscription-key": os.getenv("SARVAM_API_KEY", "")},
                       json={"input": text, "source_language_code": "en-IN", "target_language_code": code, "model": os.getenv("SARVAM_TRANSLATE_MODEL", "sarvam-translate:v1")}, timeout=40)
        if r.status_code in (401, 402, 403, 429): _trip(f"Sarvam returned {r.status_code} (check credits, plan or key)", 600); return None
        r.raise_for_status(); return r.json().get("translated_text")
    except Exception as e:
        _trip(str(e)[:100], 60); return None
def tr_many(texts, lang):
    """Return (translated list in the same order, True only if every string is translated). Missing translations fall back to English."""
    if lang == "en" or not texts: return list(texts), True
    c = D.conn(); out = {}; todo = []; ok = configured() and time.time() >= _off["until"]
    for t in dict.fromkeys(texts):
        r = c.execute("select text from translations where k=?", (_k(lang, t),)).fetchone()
        if r: out[t] = r[0]
        elif t.strip() and ok: todo.append(t)
        else: out[t] = t
    complete = ok
    if todo:
        if provider() == "gemini":
            chunks = [todo[i:i + 30] for i in range(0, len(todo), 30)]
            with ThreadPoolExecutor(2) as ex: res = list(ex.map(lambda ch: _gemini_batch(ch, lang), chunks))
            pairs = [(t, x) for ch, rr in zip(chunks, res) for t, x in zip(ch, rr or [None] * len(ch))]
        else:
            with ThreadPoolExecutor(4 if provider() == "google" else 6) as ex: rr = list(ex.map(lambda t: _one(t, lang), todo))
            pairs = list(zip(todo, rr))
        for t, x in pairs:
            out[t] = x or t
            if x: c.execute("insert or replace into translations values(?,?)", (_k(lang, t), x))
        c.commit(); complete = all(x for _, x in pairs)
    c.close()
    return [out[t] for t in texts], bool(ok and complete)
def tr_obj(o, fields, lang):
    texts = []
    for f in fields: texts += [o[f]] if isinstance(o[f], str) else list(o[f])
    out, _ = tr_many(texts, lang); i = 0; r = dict(o)
    for f in fields:
        if isinstance(o[f], str): r[f] = out[i]; i += 1
        else: n = len(o[f]); r[f] = out[i:i + n]; i += n
    return r
