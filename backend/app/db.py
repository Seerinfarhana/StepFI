import sqlite3, json, csv, os
from pathlib import Path
from .security import hash_pw
BASE = Path(__file__).resolve().parent.parent; DATA = BASE / "data"; DB = Path(os.getenv("DB_PATH", str(BASE / "stepfi.db")))   # set DB_PATH to a persistent volume when hosting
def conn():
    c = sqlite3.connect(DB, timeout=30, check_same_thread=False); c.row_factory = sqlite3.Row; return c
def rows(c, sql, a=()): return [dict(r) for r in c.execute(sql, a).fetchall()]
def row(c, sql, a=()):
    r = c.execute(sql, a).fetchone(); return dict(r) if r else None
def load(n): return json.load(open(DATA / n, encoding="utf-8"))
SCHEMA = """
create table if not exists users(id integer primary key autoincrement, role text not null, name text not null, email text unique not null, password_hash text not null, email_verified integer default 0, status text default 'pending_email', profile text default '{}', language text default 'en', created_at text default (datetime('now')));
create table if not exists email_codes(email text primary key, code_hash text, expires integer, attempts integer default 0);
create table if not exists accounts(user_id integer primary key, account_no text, account_type text, balance integer, card_status text, status text);
create table if not exists transactions(id integer primary key autoincrement, user_id integer, ts text, direction text, txn_type text, category text, amount real, fee_reason text);
create table if not exists loans(id text primary key, segment text, data text);
create table if not exists services(id text primary key, category text, data text);
create table if not exists form_templates(id text primary key, data text);
create table if not exists chats(id integer primary key autoincrement, user_id integer, language text, title text, created_at text default (datetime('now')));
create table if not exists messages(id integer primary key autoincrement, chat_id integer, role text, text text, topic text, has_image integer default 0, form_id integer, created_at text default (datetime('now')));
create table if not exists feedback(id integer primary key autoincrement, message_id integer unique, user_id integer, rating text, reason text, created_at text default (datetime('now')));
create table if not exists forms(id integer primary key autoincrement, user_id integer, chat_id integer, form_type text, data text, pdf blob, created_at text default (datetime('now')));
create table if not exists form_drafts(id integer primary key autoincrement, user_id integer, mime text, image blob, title text, fields text, created_at text default (datetime('now')));
create table if not exists translations(k text primary key, text text);
"""
def loan_matches(l, p):
    ut = p.get("user_type"); age = int(p.get("age") or 0)
    if ut not in l["user_types"] or not (l["min_age"] <= age <= l["max_age"]): return False
    if l["area"] != "any" and l["area"] != p.get("area"): return False
    if ut == "student" and l["study_levels"] and p.get("study_level") not in l["study_levels"]: return False
    return True
def init_db():
    c = conn(); c.executescript(SCHEMA)
    for t in ("loans", "services", "form_templates"): c.execute(f"delete from {t}")
    for l in load("loans.json"): c.execute("insert into loans values(?,?,?)", (l["id"], l["segment"], json.dumps(l, ensure_ascii=False)))
    for s in load("services.json"): c.execute("insert into services values(?,?,?)", (s["id"], s["category"], json.dumps(s, ensure_ascii=False)))
    for f in load("forms.json"): c.execute("insert into form_templates values(?,?)", (f["id"], json.dumps(f)))
    if not c.execute("select 1 from users limit 1").fetchone():
        demo = hash_pw(os.getenv("DEMO_PASSWORD", "StepFI@2026")); ids = {}
        for r in csv.DictReader(open(DATA / "customers.csv", encoding="utf-8")):
            prof = {k: r[k] for k in ("age", "user_type", "account_type", "study_level", "disability_type", "area", "district", "state", "simple_mode", "kyc_status", "pan_linked", "phone")}
            prof["age"] = int(prof["age"])
            cur = c.execute("insert into users(role,name,email,password_hash,email_verified,status,profile,language) values('customer',?,?,?,1,'active',?,?)", (r["full_name"], r["email"], demo, json.dumps(prof), r["preferred_language"]))
            ids[r["customer_id"]] = cur.lastrowid
        acc = {}
        for r in csv.DictReader(open(DATA / "accounts.csv", encoding="utf-8")):
            c.execute("insert into accounts values(?,?,?,?,?,?)", (ids[r["customer_id"]], r["masked_account_no"], r["account_type"], int(r["balance_inr"]), r["card_status"], r["status"])); acc[r["account_id"]] = ids[r["customer_id"]]
        for r in csv.DictReader(open(DATA / "transactions.csv", encoding="utf-8")):
            c.execute("insert into transactions(user_id,ts,direction,txn_type,category,amount,fee_reason) values(?,?,?,?,?,?,?)", (ids[r["customer_id"]], r["timestamp"], r["direction"], r["txn_type"], r["category"], float(r["amount_inr"]), r["fee_reason"]))
        c.execute("insert into users(role,name,email,password_hash,email_verified,status,profile,language) values('admin','Demo Admin',?,?,1,'active',?,'en')",
                  (os.getenv("ADMIN_EMAIL", "admin@stepfi.example.com"), hash_pw(os.getenv("ADMIN_PASSWORD", "Admin@2026")), json.dumps({"employee_id": "ADM001", "bank": "Sample National Bank", "branch": "Head Office", "job_title": "Digital Banking Head"})))
    if not c.execute("select 1 from translations limit 1").fetchone() and (DATA / "translations_seed.json").exists():
        c.executemany("insert or ignore into translations values(?,?)", json.load(open(DATA / "translations_seed.json", encoding="utf-8")))
    c.commit(); c.close()
