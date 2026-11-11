import os, time, secrets, hashlib, smtplib
from email.message import EmailMessage
import bcrypt, jwt
SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
def hash_pw(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def check_pw(p, h):
    try: return bcrypt.checkpw(p.encode(), h.encode())
    except Exception: return False
def make_token(uid, role): return jwt.encode({"sub": str(uid), "role": role, "exp": int(time.time()) + 12 * 3600}, SECRET, algorithm="HS256")
def read_token(t): return jwt.decode(t, SECRET, algorithms=["HS256"])
def new_code(): return f"{secrets.randbelow(10**6):06d}"
def code_hash(email, code): return hashlib.sha256(f"{SECRET}|{email}|{code}".encode()).hexdigest()
def send_mail(to, subject, body):
    host = os.getenv("SMTP_HOST")
    if not host:
        print(f"[DEV EMAIL] to={to} subject={subject}\n{body}"); return
    m = EmailMessage(); m["From"] = os.getenv("SMTP_FROM", "no-reply@stepfi.example.com"); m["To"] = to; m["Subject"] = subject; m.set_content(body)
    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587"))) as s:
        s.starttls()
        if os.getenv("SMTP_USER"): s.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS", ""))
        s.send_message(m)
