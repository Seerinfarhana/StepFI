import os, re, json, hmac, time, logging
from collections import Counter
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from . import db as D, security as S, translate as T, rag, agent, pdfgen, formfill
app = FastAPI(title="StepFI API")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_methods=["*"], allow_headers=["*"])
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$"); PHONE = re.compile(r"^[6-9]\d{9}$")
OPT = D.load("options.json"); LANGS = D.load("languages.json")
@app.on_event("startup")
def startup(): D.init_db(); rag.build()
def db():
    c = D.conn()
    try: yield c
    finally: c.close()
def pub(u):
    return {"id": u["id"], "role": u["role"], "name": u["name"], "email": u["email"], "language": u["language"], "status": u["status"], "profile": json.loads(u["profile"] or "{}")}
def me(authorization: str = Header(None), c=Depends(db)):
    if not authorization or not authorization.startswith("Bearer "): raise HTTPException(401, "err.session")
    try: p = S.read_token(authorization[7:])
    except Exception: raise HTTPException(401, "err.session")
    u = D.row(c, "select * from users where id=?", (int(p["sub"]),))
    if not u or u["status"] != "active": raise HTTPException(401, "err.session")
    return u
def admin(u=Depends(me)):
    if u["role"] != "admin": raise HTTPException(403, "err.adminOnly")
    return u
def pw_ok(p): return len(p) >= 8 and re.search(r"[A-Za-z]", p) and re.search(r"\d", p)
def issue_code(c, email):
    code = S.new_code()
    c.execute("insert or replace into email_codes values(?,?,?,0)", (email, S.code_hash(email, code), int(time.time()) + 600)); c.commit()
    S.send_mail(email, "Your StepFI verification code", f"Your StepFI code is {code}. It expires in 10 minutes.")
    return code if os.getenv("DEV_SHOW_CODE", "true") == "true" else None
def upsert_user(c, role, name, email, pw, profile, lang):
    old = D.row(c, "select * from users where email=?", (email,))
    if old and old["email_verified"]: raise HTTPException(409, "err.exists")
    if old: c.execute("update users set role=?,name=?,password_hash=?,profile=?,language=? where id=?", (role, name, S.hash_pw(pw), json.dumps(profile), lang, old["id"]))
    else: c.execute("insert into users(role,name,email,password_hash,profile,language) values(?,?,?,?,?,?)", (role, name, email, S.hash_pw(pw), json.dumps(profile), lang))
    c.commit()
# ---------- public ----------
@app.get("/api/languages")
def languages(): return [{"code": l["code"], "native": l["native"], "name": l["name"]} for l in LANGS]
@app.get("/api/options")
def options(): return OPT
@app.get("/api/stats/public")
def public_stats(c=Depends(db)):
    return {"languages": len(LANGS), "services": c.execute("select count(*) from services").fetchone()[0], "loans": c.execute("select count(*) from loans").fetchone()[0]}
@app.get("/api/i18n/{lang}")
def i18n(lang: str):
    if lang not in {l["code"] for l in LANGS}: raise HTTPException(404, "Unknown language")
    en = json.load(open(D.BASE / "content" / "en.json", encoding="utf-8"))
    keys = list(en); out, ok = T.tr_many([en[k] for k in keys], lang)
    return {"lang": lang, "dir": "rtl" if lang in T.RTL else "ltr", "translated": ok, "strings": dict(zip(keys, out))}
# ---------- auth ----------
class CustomerReg(BaseModel):
    name: str; email: str; phone: str; password: str; age: int; user_type: str; account_type: str; area: str; purpose: str
    study_level: str = ""; disability_type: str = ""; language: str = "en"; consent: bool = False
class AdminReg(BaseModel):
    name: str; email: str; phone: str; password: str; employee_id: str; bank: str; branch: str; job_title: str; invite_code: str; language: str = "en"
@app.post("/api/auth/register/customer")
def reg_customer(b: CustomerReg, c=Depends(db)):
    email = b.email.strip().lower()
    if not b.name.strip(): raise HTTPException(400, "err.required")
    if not EMAIL.match(email): raise HTTPException(400, "err.email")
    if not PHONE.match(b.phone): raise HTTPException(400, "err.phone")
    if b.age < 18: raise HTTPException(400, "err.age")
    if not pw_ok(b.password): raise HTTPException(400, "err.password")
    if not b.consent: raise HTTPException(400, "err.consent")
    if b.user_type not in OPT["user_types"] or b.account_type not in OPT["account_types"] or b.area not in OPT["areas"] or b.purpose not in OPT["purposes"]: raise HTTPException(400, "err.option")
    if b.user_type == "student" and b.study_level not in OPT["study_levels"]: raise HTTPException(400, "err.option")
    if b.user_type == "person_with_disability" and b.disability_type not in OPT["disability_types"]: raise HTTPException(400, "err.option")
    prof = {"age": b.age, "phone": b.phone, "user_type": b.user_type, "account_type": b.account_type, "area": b.area, "purpose": b.purpose,
            "study_level": b.study_level if b.user_type == "student" else "", "disability_type": b.disability_type if b.user_type == "person_with_disability" else "",
            "simple_mode": "yes" if b.age >= 60 else "no", "kyc_status": "pending"}
    upsert_user(c, "customer", b.name.strip(), email, b.password, prof, b.language)
    return {"email": email, "dev_code": issue_code(c, email)}
@app.post("/api/auth/register/admin")
def reg_admin(b: AdminReg, c=Depends(db)):
    email = b.email.strip().lower(); invite = os.getenv("ADMIN_INVITE_CODE", "")
    if not all(x.strip() for x in (b.name, b.employee_id, b.bank, b.branch, b.job_title)): raise HTTPException(400, "err.required")
    if not EMAIL.match(email): raise HTTPException(400, "err.email")
    if not PHONE.match(b.phone): raise HTTPException(400, "err.phone")
    if not pw_ok(b.password): raise HTTPException(400, "err.password")
    if not invite or not hmac.compare_digest(invite, b.invite_code.strip()): raise HTTPException(403, "err.invite")
    prof = {"phone": b.phone, "employee_id": b.employee_id.strip(), "bank": b.bank.strip(), "branch": b.branch.strip(), "job_title": b.job_title.strip()}
    upsert_user(c, "admin", b.name.strip(), email, b.password, prof, b.language)
    return {"email": email, "dev_code": issue_code(c, email)}
class Verify(BaseModel): email: str; code: str
@app.post("/api/auth/verify")
def verify(b: Verify, c=Depends(db)):
    email = b.email.strip().lower(); r = D.row(c, "select * from email_codes where email=?", (email,)); u = D.row(c, "select * from users where email=?", (email,))
    if not r or not u or r["expires"] < time.time() or r["attempts"] >= 5: raise HTTPException(400, "err.code")
    if not hmac.compare_digest(r["code_hash"], S.code_hash(email, b.code.strip())):
        c.execute("update email_codes set attempts=attempts+1 where email=?", (email,)); c.commit(); raise HTTPException(400, "err.code")
    status = "active" if u["role"] == "customer" else "pending_approval"
    c.execute("update users set email_verified=1,status=? where id=?", (status, u["id"])); c.execute("delete from email_codes where email=?", (email,)); c.commit()
    u["status"] = status
    return {"status": status, "token": S.make_token(u["id"], u["role"]) if status == "active" else None, "user": pub(u)}
class Email(BaseModel): email: str
@app.post("/api/auth/resend")
def resend(b: Email, c=Depends(db)):
    email = b.email.strip().lower(); u = D.row(c, "select * from users where email=?", (email,))
    if not u or u["email_verified"]: raise HTTPException(400, "err.code")
    return {"dev_code": issue_code(c, email)}
class Login(BaseModel): email: str; password: str
@app.post("/api/auth/login")
def login(b: Login, c=Depends(db)):
    u = D.row(c, "select * from users where email=?", (b.email.strip().lower(),))
    if not u or not S.check_pw(b.password, u["password_hash"]): raise HTTPException(401, "err.badlogin")
    if not u["email_verified"]: raise HTTPException(403, "err.unverified")
    if u["status"] == "pending_approval": raise HTTPException(403, "err.pending")
    if u["status"] == "rejected": raise HTTPException(403, "err.rejected")
    return {"token": S.make_token(u["id"], u["role"]), "user": pub(u)}
@app.get("/api/auth/me")
def whoami(u=Depends(me)): return pub(u)
# ---------- customer data ----------
@app.get("/api/me/account")
def my_account(lang: str = "en", u=Depends(me), c=Depends(db)):
    tx = D.rows(c, "select ts,direction,txn_type,category,amount,fee_reason from transactions where user_id=? order by ts desc limit 6", (u["id"],))
    for x in tx: x["category"] = x["category"].replace("_", " ")
    if lang != "en" and tx:
        out, _ = T.tr_many([x["category"] for x in tx] + [x["fee_reason"] for x in tx if x["fee_reason"]], lang); k = len(tx)
        for i, x in enumerate(tx): x["category"] = out[i]
        it = iter(out[k:])
        for x in tx:
            if x["fee_reason"]: x["fee_reason"] = next(it)
    return {"account": D.row(c, "select account_no,account_type,balance,card_status,status from accounts where user_id=?", (u["id"],)), "transactions": tx}
def loan_list(c): return [json.loads(r["data"]) for r in D.rows(c, "select data from loans")]
@app.get("/api/loans")
def loans(lang: str = "en", recommended: bool = False, u=Depends(me), c=Depends(db)):
    ls = loan_list(c)
    if recommended: ls = [l for l in ls if D.loan_matches(l, json.loads(u["profile"]))]
    return [{**T.tr_obj({k: l[k] for k in ("name", "summary")}, ("name", "summary"), lang), "id": l["id"], "segment": l["segment"], "max_amount_inr": l["max_amount_inr"], "rate_range_pct": l["rate_range_pct"]} for l in ls]
@app.get("/api/loans/{lid}")
def loan(lid: str, lang: str = "en", u=Depends(me), c=Depends(db)):
    r = D.row(c, "select data from loans where id=?", (lid,))
    if not r: raise HTTPException(404, "Not found")
    return T.tr_obj(json.loads(r["data"]), ("name", "summary", "note", "eligibility", "terms", "documents", "how_to_apply"), lang)
@app.get("/api/services")
def services(lang: str = "en", u=Depends(me), c=Depends(db)):
    out = []
    for r in D.rows(c, "select data from services"):
        s = json.loads(r["data"]); out.append({**T.tr_obj({"name": s["name"]}, ("name",), lang), "id": s["id"], "category": s["category"], "channel": s["channel"]})
    return out
@app.get("/api/services/{sid}")
def service(sid: str, lang: str = "en", u=Depends(me), c=Depends(db)):
    r = D.row(c, "select data from services where id=?", (sid,))
    if not r: raise HTTPException(404, "Not found")
    return T.tr_obj(json.loads(r["data"]), ("name", "description", "how_it_works", "documents", "steps"), lang)
# ---------- assistant ----------
@app.post("/api/chat")
def chat(message: str = Form(""), chat_id: int | None = Form(None), lang: str = Form("en"), image: UploadFile | None = File(None), u=Depends(me), c=Depends(db)):
    message = message.strip(); img = None
    if image is not None and image.filename:
        data = image.file.read()
        if image.content_type not in ("image/jpeg", "image/png", "image/webp") or len(data) > 5 * 1024 * 1024: raise HTTPException(400, "err.image")
        img = (image.content_type, data)
    if not message and not img: raise HTTPException(400, "err.empty")
    if chat_id:
        ch = D.row(c, "select * from chats where id=? and user_id=?", (chat_id, u["id"]))
        if not ch: raise HTTPException(404, "Not found")
    else:
        chat_id = c.execute("insert into chats(user_id,language,title) values(?,?,?)", (u["id"], lang, (message or "Photo of a form")[:60])).lastrowid
    hist = D.rows(c, "select role,text,has_image from messages where chat_id=? order by id desc limit 12", (chat_id,))[::-1]
    hist = [{"role": h["role"], "text": h["text"] + (" [photo of a form was shared]" if h["has_image"] else "")} for h in hist]
    c.execute("insert into messages(chat_id,role,text,has_image) values(?,?,?,?)", (chat_id, "user", message or "(photo)", 1 if img else 0)); c.commit()
    ctx = {"c": c, "user": u, "profile": json.loads(u["profile"]), "lang": lang, "chat_id": chat_id}
    try: text, form_id, topic = agent.respond(ctx, hist, message, img)
    except Exception as e:
        logging.exception("assistant failed"); raise HTTPException(502, "chat.error")
    mid = c.execute("insert into messages(chat_id,role,text,topic,form_id) values(?,?,?,?,?)", (chat_id, "assistant", text, topic, form_id)).lastrowid; c.commit()
    return {"chat_id": chat_id, "message_id": mid, "text": text, "form_id": form_id}
@app.get("/api/chats")
def chats(u=Depends(me), c=Depends(db)): return D.rows(c, "select id,title,created_at from chats where user_id=? order by id desc limit 8", (u["id"],))
@app.get("/api/chats/{cid}/messages")
def chat_messages(cid: int, u=Depends(me), c=Depends(db)):
    if not D.row(c, "select 1 from chats where id=? and user_id=?", (cid, u["id"])): raise HTTPException(404, "Not found")
    return D.rows(c, "select m.id,m.role,m.text,m.form_id,f.rating from messages m left join feedback f on f.message_id=m.id where m.chat_id=? order by m.id", (cid,))
class FB(BaseModel): message_id: int; rating: str; reason: str | None = None
@app.post("/api/feedback")
def feedback(b: FB, u=Depends(me), c=Depends(db)):
    if b.rating not in ("like", "dislike") or (b.reason and b.reason not in OPT["reasons"]): raise HTTPException(400, "err.option")
    if not D.row(c, "select 1 from messages m join chats h on h.id=m.chat_id where m.id=? and m.role='assistant' and h.user_id=?", (b.message_id, u["id"])): raise HTTPException(404, "Not found")
    c.execute("insert into feedback(message_id,user_id,rating,reason) values(?,?,?,?) on conflict(message_id) do update set rating=excluded.rating,reason=excluded.reason", (b.message_id, u["id"], b.rating, b.reason if b.rating == "dislike" else None)); c.commit()
    return {"ok": True}
@app.post("/api/forms/analyze")
def forms_analyze(image: UploadFile = File(...), lang: str = Form("en"), u=Depends(me), c=Depends(db)):
    data = image.file.read()
    if image.content_type not in ("image/jpeg", "image/png", "image/webp") or len(data) > 5 * 1024 * 1024: raise HTTPException(400, "err.image")
    key = os.getenv("GEMINI_API_KEY")
    if not key: raise HTTPException(503, "err.noai")
    try: title, fields = formfill.analyze(data, image.content_type, key, os.getenv("GEMINI_VISION_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.5-flash"))
    except Exception: logging.exception("form analysis failed"); raise HTTPException(502, "form.failed")
    if not fields: raise HTTPException(422, "form.failed")
    did = c.execute("insert into form_drafts(user_id,mime,image,title,fields) values(?,?,?,?,?)", (u["id"], image.content_type, data, title, json.dumps(fields))).lastrowid; c.commit()
    local, _ = T.tr_many([f["label"] for f in fields], lang)
    return {"draft_id": did, "title": title, "fields": [{"id": f["id"], "label": f["label"], "label_local": local[i], "type": f["type"], "cells": f["cells"], "section": f["section"], "hint": f["hint"]} for i, f in enumerate(fields)]}
class FillBody(BaseModel): values: dict[str, str | bool] = {}; dx: int = 0; dy: int = 0; preview: bool = True
@app.post("/api/forms/{did}/fill")
def forms_fill(did: int, b: FillBody, u=Depends(me), c=Depends(db)):
    d = D.row(c, "select * from form_drafts where id=? and user_id=?", (did, u["id"]))
    if not d: raise HTTPException(404, "Not found")
    o = formfill.ops(json.loads(d["fields"]), b.values, max(-60, min(60, b.dx)), max(-60, min(60, b.dy)))
    if b.preview: return {"image": "data:image/jpeg;base64," + formfill.preview_b64(d["image"], o)}
    pdf = formfill.pdf_bytes(d["image"], o, d["title"])
    c.execute("insert into forms(user_id,chat_id,form_type,data,pdf) values(?,?,?,?,?)", (u["id"], None, "photo_form", json.dumps(sorted(b.values)), pdf)); c.commit()
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="filled_form.pdf"'})
@app.get("/api/forms/{fid}/pdf")
def form_pdf(fid: int, u=Depends(me), c=Depends(db)):
    r = D.row(c, "select pdf,form_type from forms where id=? and user_id=?", (fid, u["id"]))
    if not r: raise HTTPException(404, "Not found")
    return Response(r["pdf"], media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{r["form_type"]}.pdf"'})
# ---------- admin ----------
@app.get("/api/admin/stats")
def stats(a=Depends(admin), c=Depends(db)):
    n = lambda sql: c.execute(sql).fetchone()[0]; likes = n("select count(*) from feedback where rating='like'"); dis = n("select count(*) from feedback where rating='dislike'")
    return {"customers": n("select count(*) from users where role='customer' and status='active'"), "chats": n("select count(*) from chats"), "questions": n("select count(*) from messages where role='user'"),
            "rated": likes + dis, "likes": likes, "dislikes": dis, "satisfaction": round(100 * likes / (likes + dis)) if likes + dis else None, "forms": n("select count(*) from forms"), "pending_admins": n("select count(*) from users where status='pending_approval'"),
            "per_day": D.rows(c, "select date(created_at) d, sum(rating='like') likes, sum(rating='dislike') dislikes from feedback group by d order by d desc limit 14")[::-1],
            "topics": D.rows(c, "select topic name, count(*) n from messages where role='assistant' and topic is not null group by topic order by n desc limit 8"),
            "reasons": D.rows(c, "select reason name, count(*) n from feedback where reason is not null group by reason order by n desc"),
            "languages": D.rows(c, "select language name, count(*) n from chats group by language order by n desc")}
@app.get("/api/admin/pending")
def pending(a=Depends(admin), c=Depends(db)): return [{"id": r["id"], "name": r["name"], "email": r["email"], "profile": json.loads(r["profile"])} for r in D.rows(c, "select * from users where status='pending_approval'")]
class Decision(BaseModel): approve: bool
@app.post("/api/admin/pending/{uid}")
def decide(uid: int, b: Decision, a=Depends(admin), c=Depends(db)):
    c.execute("update users set status=? where id=? and status='pending_approval'", ("active" if b.approve else "rejected", uid)); c.commit(); return {"ok": True}
def pdf_response(data, name): return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})
@app.get("/api/admin/reports/customers.pdf")
def report_customers(a=Depends(admin), c=Depends(db)):
    us = [(r, json.loads(r["profile"])) for r in D.rows(c, "select * from users where role='customer' and status='active' order by id")]
    cnt = lambda f: sorted(Counter(f(r, p) or "none" for r, p in us).items(), key=lambda x: -x[1])
    mask_e = lambda e: e[:2] + "***@" + e.split("@")[-1]; mask_p = lambda p: "xxxxxx" + str(p)[-4:] if p else ""
    sec = [("h", "Summary"), ("p", f"{len(us)} active customers. Contact details are masked in this report.")]
    for title, f in (("By customer type", lambda r, p: p.get("user_type")), ("By account type", lambda r, p: p.get("account_type")), ("By area", lambda r, p: p.get("area")), ("By language", lambda r, p: r["language"]), ("By KYC status", lambda r, p: p.get("kyc_status"))):
        sec += [("h", title), ("t", [["Group", "Customers"]] + [[k, v] for k, v in cnt(f)])]
    sec += [("h", "Customer list"), ("t", [["Name", "Age", "Type", "Account", "Area", "Lang", "Email", "Phone"]] + [[r["name"], p.get("age", ""), p.get("user_type", ""), p.get("account_type", ""), p.get("area", ""), r["language"], mask_e(r["email"]), mask_p(p.get("phone"))] for r, p in us])]
    return pdf_response(pdfgen.report_pdf("Customer summary", sec), "customer_summary.pdf")
@app.get("/api/admin/reports/feedback.pdf")
def report_feedback(a=Depends(admin), c=Depends(db)):
    s = stats(a, c); sec = [("h", "Overview"), ("t", [["Measure", "Value"], ["Conversations", s["chats"]], ["Questions asked", s["questions"]], ["Rated answers", s["rated"]], ["Liked", s["likes"]], ["Disliked", s["dislikes"]], ["Satisfaction", f"{s['satisfaction']}%" if s["satisfaction"] is not None else "No ratings yet"], ["Forms generated", s["forms"]]])]
    if not s["rated"]: sec.append(("p", "No feedback has been collected yet. This report fills in as customers rate assistant answers."))
    sec += [("h", "Topics"), ("t", [["Topic", "Answers"]] + [[t["name"], t["n"]] for t in s["topics"]] or [["None", 0]]), ("h", "Reasons for dislikes"), ("t", [["Reason", "Count"]] + ([[t["name"], t["n"]] for t in s["reasons"]] or [["None", 0]]))]
    bad = D.rows(c, "select (select text from messages q where q.chat_id=m.chat_id and q.role='user' and q.id<m.id order by q.id desc limit 1) q, f.reason from feedback f join messages m on m.id=f.message_id where f.rating='dislike' order by f.id desc limit 15")
    sec += [("h", "Recent disliked answers (numbers hidden)"), ("t", [["Customer question", "Reason"]] + ([[re.sub(r"\d", "#", (b["q"] or ""))[:120], b["reason"] or ""] for b in bad] or [["None", ""]]))]
    return pdf_response(pdfgen.report_pdf("Feedback summary", sec), "feedback_summary.pdf")

# ---------- serve the built website (one service for site + API when hosting) ----------
DIST = D.BASE.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    @app.get("/{path:path}", include_in_schema=False)
    def website(path: str):
        if path.startswith("api/"): raise HTTPException(404, "Not found")
        f = (DIST / path).resolve()
        return FileResponse(f if path and DIST.resolve() in f.parents and f.is_file() else DIST / "index.html")
