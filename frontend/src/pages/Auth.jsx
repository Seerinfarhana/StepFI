import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { UserCircle, ShieldCheck, CheckCircle } from "@phosphor-icons/react";
import { useT } from "../i18n"; import { useAuth } from "../auth"; import { api } from "../api"; import { useData } from "../hooks";
import { Logo, LanguageMenu, Field, Chips, ErrorNote, Skeleton } from "../ui";
function Shell({ title, children, wide }) {
  return <><header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><Logo /><LanguageMenu /></header>
    <main id="main" className={"mx-auto flex flex-col gap-6 px-4 py-8 " + (wide ? "max-w-2xl" : "max-w-md")}><h1 className="heading-4">{title}</h1>{children}</main></>;
}
export function LanguagePage() {
  const { t, lang, langs, setLang, loading } = useT(), nav = useNavigate(), [q, setQ] = useState("");
  const list = langs.filter(l => (l.native + l.name).toLowerCase().includes(q.toLowerCase()));
  return <main id="main" className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16"><Logo /><h1 className="heading-4">{t("lang.title")}</h1><p className="body-6 text-mute">{t("lang.hint")}</p>
    <input className="input" placeholder={t("lang.search")} aria-label={t("lang.search")} value={q} onChange={e => setQ(e.target.value)} />
    {loading && <Skeleton className="h-2 w-full" />}
    <ul role="listbox" aria-label={t("lang.title")} className="card flex max-h-96 flex-col gap-1 overflow-auto p-2">
      {!langs.length && [1, 2, 3, 4, 5].map(i => <li key={i}><Skeleton className="h-10 w-full" /></li>)}
      {list.map(l => <li key={l.code}><button type="button" role="option" aria-selected={l.code === lang} onClick={() => setLang(l.code)} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-start body-2 hover:bg-mint"><span>{l.native}</span><span className="flex items-center gap-2 caption-2 text-mute">{l.name}{l.code === lang && <CheckCircle size={20} weight="fill" className="text-brand" />}</span></button></li>)}
    </ul>
    <button type="button" className="btn btn-primary button-md" onClick={() => { localStorage.setItem("lang", lang); nav("/"); }}>{t("lang.cont")}</button></main>;
}
export function Login() {
  const { t } = useT(), { signIn } = useAuth(), nav = useNavigate(), [f, setF] = useState({ email: "", password: "" }), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); if (!f.email.trim() || !f.password) return setErr("err.required"); setBusy(true); setErr(null);
    try { const r = await api.post("/auth/login", f); signIn(r.token, r.user); nav(r.user.role === "admin" ? "/admin" : "/app/home"); } catch (x) { setErr(x); } setBusy(false); };
  return <Shell title={t("login.title")}><form onSubmit={submit} className="card flex flex-col gap-4" noValidate>
    <Field label={t("login.email")}><input className="input" type="email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
    <Field label={t("login.password")}><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
    <ErrorNote error={err} /><button className="btn btn-primary button-md" disabled={busy}>{t("login.btn")}</button></form>
    <p className="body-6 text-mute">{t("login.new")} <Link to="/register" className="body-4 text-brand">{t("login.create")}</Link></p></Shell>;
}
export function ChooseRole() {
  const { t } = useT();
  return <Shell title={t("start.title")}><p className="body-6 text-mute">{t("start.sub")}</p>
    {[["/register/customer", UserCircle, "start.customer", "start.customerSub"], ["/register/admin", ShieldCheck, "start.admin", "start.adminSub"]].map(([to, I, a, b]) =>
      <Link key={to} to={to} className="card flex items-center gap-4 transition-transform duration-500 ease-base hover:-translate-y-1"><I size={32} className="text-brand" aria-hidden="true" /><div><p className="title-2">{t(a)}</p><p className="body-6 text-mute">{t(b)}</p></div></Link>)}
    <p className="body-6 text-mute">{t("login.title")}: <Link to="/login" className="body-4 text-brand">{t("nav.signin")}</Link></p></Shell>;
}
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), pwOk = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
export function RegisterCustomer() {
  const { t, lang } = useT(), nav = useNavigate(), o = useData("/options").data, [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", confirm: "", age: "", user_type: "student", account_type: "student", study_level: "undergraduate", disability_type: "", area: "urban", purpose: "find_loan", consent: false });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const submit = async e => { e.preventDefault(); setErr(null);
    const bad = !f.name.trim() ? "err.required" : !emailOk(f.email) ? "err.email" : !/^[6-9]\d{9}$/.test(f.phone) ? "err.phone" : !(+f.age >= 18) ? "err.age" : !pwOk(f.password) ? "err.password" : f.password !== f.confirm ? "err.match" : f.user_type === "person_with_disability" && !f.disability_type ? "err.required" : !f.consent ? "err.consent" : null;
    if (bad) return setErr(bad); setBusy(true);
    const { confirm, ...body } = f;
    try { const r = await api.post("/auth/register/customer", { ...body, age: +f.age, language: lang }); nav("/verify", { state: { email: r.email, dev_code: r.dev_code, role: "customer" } }); } catch (x) { setErr(x); } setBusy(false); };
  if (!o) return <Shell title={t("reg.ctitle")} wide><Skeleton className="h-64 w-full" /></Shell>;
  return <Shell title={t("reg.ctitle")} wide><form onSubmit={submit} className="card flex flex-col gap-4" noValidate>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label={t("reg.name")}><input className="input" autoComplete="name" value={f.name} onChange={e => set("name", e.target.value)} /></Field>
      <Field label={t("reg.age")}><input className="input" type="number" min="18" value={f.age} onChange={e => set("age", e.target.value)} /></Field>
      <Field label={t("reg.email")}><input className="input" type="email" autoComplete="email" value={f.email} onChange={e => set("email", e.target.value)} /></Field>
      <Field label={t("reg.phone")}><input className="input" inputMode="numeric" maxLength={10} value={f.phone} onChange={e => set("phone", e.target.value.replace(/\D/g, ""))} /></Field>
      <Field label={t("reg.password")}><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={e => set("password", e.target.value)} /></Field>
      <Field label={t("reg.confirm")}><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={e => set("confirm", e.target.value)} /></Field></div>
    <p className="caption-2 text-mute">{t("reg.pwhint")}</p>
    <p className="caption-1 text-mute">{t("reg.iam")}</p><Chips label={t("reg.iam")} value={f.user_type} onChange={v => set("user_type", v)} options={o.user_types} prefix="ut." />
    <p className="caption-1 text-mute">{t("reg.account")}</p><Chips label={t("reg.account")} value={f.account_type} onChange={v => set("account_type", v)} options={o.account_types} prefix="acct." />
    {f.user_type === "student" && <><p className="caption-1 text-mute">{t("reg.study")}</p><Chips label={t("reg.study")} value={f.study_level} onChange={v => set("study_level", v)} options={o.study_levels} prefix="study." /></>}
    {f.user_type === "person_with_disability" && <><p className="caption-1 text-mute">{t("reg.disability")}</p><Chips label={t("reg.disability")} value={f.disability_type} onChange={v => set("disability_type", v)} options={o.disability_types} prefix="dis." /></>}
    <p className="caption-1 text-mute">{t("reg.area")}</p><Chips label={t("reg.area")} value={f.area} onChange={v => set("area", v)} options={o.areas} prefix="area." />
    <p className="caption-1 text-mute">{t("reg.purpose")}</p><Chips label={t("reg.purpose")} value={f.purpose} onChange={v => set("purpose", v)} options={o.purposes} prefix="purp." />
    <label className="flex items-start gap-2 body-6"><input type="checkbox" className="mt-1" checked={f.consent} onChange={e => set("consent", e.target.checked)} />{t("reg.consent")}</label>
    <ErrorNote error={err} /><button className="btn btn-primary button-md" disabled={busy}>{t("reg.btn")}</button></form></Shell>;
}
export function RegisterAdmin() {
  const { t, lang } = useT(), nav = useNavigate(), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", confirm: "", employee_id: "", bank: "", branch: "", job_title: "", invite_code: "" });
  const submit = async e => { e.preventDefault(); setErr(null);
    const bad = Object.entries(f).some(([k, v]) => k !== "confirm" && !String(v).trim()) ? "err.required" : !emailOk(f.email) ? "err.email" : !/^[6-9]\d{9}$/.test(f.phone) ? "err.phone" : !pwOk(f.password) ? "err.password" : f.password !== f.confirm ? "err.match" : null;
    if (bad) return setErr(bad); setBusy(true); const { confirm, ...body } = f;
    try { const r = await api.post("/auth/register/admin", { ...body, language: lang }); nav("/verify", { state: { email: r.email, dev_code: r.dev_code, role: "admin" } }); } catch (x) { setErr(x); } setBusy(false); };
  const fields = [["name", "reg.name"], ["email", "reg.email", "email"], ["phone", "reg.phone"], ["employee_id", "reg.employee"], ["bank", "reg.bank"], ["branch", "reg.branch"], ["job_title", "reg.jobtitle"], ["invite_code", "reg.invite"], ["password", "reg.password", "password"], ["confirm", "reg.confirm", "password"]];
  return <Shell title={t("reg.atitle")} wide><p className="card flex gap-3 body-6 text-mute"><ShieldCheck size={24} className="shrink-0 text-brand" aria-hidden="true" />{t("reg.note")}</p>
    <form onSubmit={submit} className="card flex flex-col gap-4" noValidate><div className="grid gap-4 md:grid-cols-2">{fields.map(([k, l, type]) => <Field key={k} label={t(l)}><input className="input" type={type || "text"} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></Field>)}</div>
      <p className="caption-2 text-mute">{t("reg.pwhint")}</p><ErrorNote error={err} /><button className="btn btn-primary button-md" disabled={busy}>{t("reg.btn")}</button></form></Shell>;
}
export function Verify() {
  const { t } = useT(), { signIn } = useAuth(), nav = useNavigate(), loc = useLocation(), st = loc.state;
  const [code, setCode] = useState(""), [dev, setDev] = useState(st?.dev_code), [err, setErr] = useState(null), [msg, setMsg] = useState(null), [pending, setPending] = useState(false), [busy, setBusy] = useState(false);
  if (!st?.email) return <Navigate to="/register" replace />;
  const submit = async e => { e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api.post("/auth/verify", { email: st.email, code }); if (r.token) { signIn(r.token, r.user); nav("/app/home"); } else setPending(true); } catch (x) { setErr(x); } setBusy(false); };
  const resend = async () => { setErr(null); try { const r = await api.post("/auth/resend", { email: st.email }); setDev(r.dev_code); setMsg(t("verify.sent")); } catch (x) { setErr(x); } };
  if (pending) return <Shell title={t("verify.title")}><p className="card flex gap-3 body-3"><CheckCircle size={24} weight="fill" className="shrink-0 text-brand" aria-hidden="true" />{t("verify.pending")}</p><Link to="/login" className="btn btn-primary button-md">{t("verify.login")}</Link></Shell>;
  return <Shell title={t("verify.title")}><form onSubmit={submit} className="card flex flex-col gap-4"><p className="body-6 text-mute">{t("verify.sub")} <span className="body-4 text-ink">{st.email}</span></p>
    <Field label={t("verify.code")}><input className="input" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
    {dev && <p className="tag caption-1">{t("verify.dev")} {dev}</p>}{msg && <p className="caption-1 text-brand">{msg}</p>}<ErrorNote error={err} />
    <button className="btn btn-primary button-md" disabled={busy || code.length !== 6}>{t("verify.btn")}</button><button type="button" className="btn btn-ghost button-md" onClick={resend}>{t("verify.resend")}</button></form></Shell>;
}
