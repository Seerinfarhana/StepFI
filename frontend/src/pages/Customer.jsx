import { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { SignOut, ChatCircleDots, ArrowRight } from "@phosphor-icons/react";
import { useT } from "../i18n"; import { useAuth } from "../auth"; import { useData, inr } from "../hooks";
import { Logo, LanguageMenu, Reveal, Skeleton, ErrorNote } from "../ui";
export function CustomerLayout() {
  const { t } = useT(), { signOut } = useAuth(), nav = useNavigate();
  return <><header className="border-b border-line bg-card"><nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3"><Logo to="/app/home" />
    <ul className="flex flex-wrap items-center gap-1">{["home", "loans", "assistant", "services"].map(p => <li key={p}><NavLink to={"/app/" + p} className={({ isActive }) => "btn button-sm " + (isActive ? "bg-mint text-brand" : "text-mute hover:bg-page")}>{t("nav." + p)}</NavLink></li>)}</ul>
    <div className="ms-auto flex items-center gap-2"><LanguageMenu /><button type="button" className="btn btn-ghost button-sm" onClick={() => { signOut(); nav("/"); }}><SignOut size={20} aria-hidden="true" />{t("nav.logout")}</button></div></nav></header>
    <main id="main" className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main></>;
}
const pretty = s => String(s || "").replaceAll("_", " ");
export function Home() {
  const { t, lang } = useT(), { user } = useAuth(), a = useData(`/me/account?lang=${lang}`), ch = useData("/chats"), p = user.profile, acc = a.data?.account, tx = a.data?.transactions || [];
  return <div className="flex flex-col gap-6"><h1 className="heading-4">{t("home.hello")} {user.name.split(" ")[0]}</h1>
    <div className="grid gap-6 md:grid-cols-3">
      <Reveal className="card flex flex-col gap-3"><h2 className="title-1">{t("home.profile")}</h2><div className="flex flex-wrap gap-2">
        <span className="tag caption-1">{t("ut." + p.user_type)}</span>{p.study_level && <span className="tag caption-1">{t("study." + p.study_level)}</span>}<span className="tag caption-1">{t("area." + p.area)}</span><span className="tag caption-1">{t("acct." + p.account_type)}</span></div></Reveal>
      <Reveal className="card flex flex-col gap-2"><h2 className="title-1">{t("home.account")}</h2>
        {a.loading && !a.data ? <Skeleton className="h-16 w-full" /> : acc ? <><p className="heading-4">{inr(acc.balance)}</p><p className="caption-2 text-mute">{t("home.balance")} · {acc.account_no}</p><p className="caption-2 text-mute">{t("home.card")}: {pretty(acc.card_status)} · {t("home.kyc")}: {pretty(p.kyc_status)}</p></> : <p className="body-6 text-mute">{t("home.noaccount")}</p>}</Reveal>
      <Reveal className="card flex flex-col items-start gap-3"><h2 className="title-1">{t("home.ask")}</h2><Link to="/app/assistant" className="btn btn-primary button-md"><ChatCircleDots size={20} aria-hidden="true" />{t("nav.assistant")}</Link></Reveal></div>
    <div className="grid gap-6 md:grid-cols-2">
      <Reveal className="card flex flex-col gap-3"><h2 className="title-1">{t("home.recent")}</h2><ErrorNote error={a.error} />
        {tx.length ? <ul className="flex flex-col gap-2">{tx.map((x, i) => <li key={i} className="flex items-center justify-between gap-4 body-6"><span><span className="capitalize">{x.fee_reason || x.category}</span><span className="block caption-5 text-mute">{x.ts.slice(0, 10)} · {x.txn_type}</span></span><span className="body-4">{x.direction === "credit" ? "+" : "−"}{inr(x.amount)}</span></li>)}</ul> : !a.loading && <p className="body-6 text-mute">{t("home.notxn")}</p>}</Reveal>
      <Reveal className="card flex flex-col gap-3"><h2 className="title-1">{t("home.chats")}</h2>
        {ch.data?.length ? <ul className="flex flex-col gap-2">{ch.data.map(c => <li key={c.id}><Link to={`/app/assistant?chat=${c.id}`} className="flex items-center justify-between gap-2 body-6 hover:text-brand"><span className="truncate">{c.title}</span><ArrowRight size={16} aria-hidden="true" /></Link></li>)}</ul> : !ch.loading && <p className="body-6 text-mute">{t("home.empty")}</p>}</Reveal></div></div>;
}
function List({ items }) { return <ul className="list-disc ps-6 body-6">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>; }
export function Loans() {
  const { t, lang } = useT(), nav = useNavigate(), [tab, setTab] = useState("match"), [seg, setSeg] = useState("all"), [sel, setSel] = useState(null);
  const opts = useData("/options").data, list = useData(`/loans?lang=${lang}${tab === "match" ? "&recommended=true" : ""}`), d = useData(sel ? `/loans/${sel}?lang=${lang}` : null);
  const items = (list.data || []).filter(l => seg === "all" || l.segment === seg);
  return <div className="flex flex-col gap-6"><div><h1 className="heading-4">{t("loans.title")}</h1><p className="body-6 mt-2 text-mute">{t("loans.note")}</p></div>
    <div className="flex flex-wrap gap-2" role="group"><button className="chip caption-1" aria-pressed={tab === "match"} onClick={() => { setTab("match"); setSeg("all"); }}>{t("loans.match")}</button><button className="chip caption-1" aria-pressed={tab === "all"} onClick={() => setTab("all")}>{t("loans.all")}</button>
      {tab === "all" && opts?.segments.map(s => <button key={s} className="chip caption-1" aria-pressed={seg === s} onClick={() => setSeg(seg === s ? "all" : s)}>{t("seg." + s)}</button>)}</div>
    <ErrorNote error={list.error} />
    <div className="grid gap-6 md:grid-cols-2"><div className="flex flex-col gap-3">
      {list.loading && !list.data && [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      {!list.loading && !items.length && <p className="card body-6 text-mute">{t("loans.none")}</p>}
      {items.map(l => <button key={l.id} onClick={() => setSel(l.id)} aria-pressed={sel === l.id} className={"card flex flex-col gap-1 text-start transition-transform duration-500 ease-base hover:-translate-y-1 " + (sel === l.id ? "border-brand" : "")}><span className="title-2">{l.name}</span><span className="body-6 text-mute">{l.summary}</span><span className="caption-1 text-brand">{t("loans.max")} {inr(l.max_amount_inr)} · {t("loans.rate")} {l.rate_range_pct}%</span></button>)}</div>
      {sel && <aside className="card flex flex-col gap-3 self-start" aria-live="polite">{d.loading && !d.data ? <Skeleton className="h-48 w-full" /> : d.data && <>
        <h2 className="heading-6">{d.data.name}</h2><p className="body-6 text-mute">{d.data.summary}</p>
        <h3 className="title-3">{t("loans.elig")}</h3><List items={d.data.eligibility} /><h3 className="title-3">{t("loans.terms")}</h3><List items={d.data.terms} />
        <h3 className="title-3">{t("loans.docs")}</h3><List items={d.data.documents} /><h3 className="title-3">{t("loans.apply")}</h3><ol className="list-decimal ps-6 body-6">{d.data.how_to_apply.map((x, i) => <li key={i}>{x}</li>)}</ol>
        <p className="caption-2 text-mute">{d.data.note}</p><button className="btn btn-primary button-md" onClick={() => nav("/app/assistant", { state: { q: d.data.name } })}>{t("loans.ask")}</button></>}<ErrorNote error={d.error} /></aside>}</div></div>;
}
export function Services() {
  const { t, lang } = useT(), nav = useNavigate(), [cat, setCat] = useState("accounts"), [sel, setSel] = useState(null);
  const list = useData(`/services?lang=${lang}`), d = useData(sel ? `/services/${sel}?lang=${lang}` : null);
  const cats = [...new Set((list.data || []).map(s => s.category))], items = (list.data || []).filter(s => s.category === cat);
  return <div className="flex flex-col gap-6"><h1 className="heading-4">{t("services.title")}</h1>
    <div className="flex flex-wrap gap-2" role="group">{cats.map(c => <button key={c} className="chip caption-1" aria-pressed={cat === c} onClick={() => { setCat(c); setSel(null); }}>{t("cat." + c)}</button>)}</div>
    <ErrorNote error={list.error} />
    <div className="grid gap-6 md:grid-cols-2"><div className="flex flex-col gap-3">
      {list.loading && !list.data && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      {items.map(s => <button key={s.id} onClick={() => setSel(s.id)} aria-pressed={sel === s.id} className={"card flex flex-col items-start gap-2 text-start transition-transform duration-500 ease-base hover:-translate-y-1 " + (sel === s.id ? "border-brand" : "")}><span className="title-2">{s.name}</span><span className="tag caption-1">{t("chan." + s.channel)}</span></button>)}</div>
      {sel && <aside className="card flex flex-col gap-3 self-start" aria-live="polite">{d.loading && !d.data ? <Skeleton className="h-48 w-full" /> : d.data && <>
        <h2 className="heading-6">{d.data.name}</h2><p className="body-6 text-mute">{d.data.description}</p><h3 className="title-3">{t("services.how")}</h3><p className="body-6">{d.data.how_it_works}</p>
        <h3 className="title-3">{t("services.docs")}</h3>{d.data.documents.length ? <List items={d.data.documents} /> : <p className="body-6">—</p>}<h3 className="title-3">{t("services.steps")}</h3><ol className="list-decimal ps-6 body-6">{d.data.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
        <button className="btn btn-primary button-md" onClick={() => nav("/app/assistant", { state: { q: d.data.name } })}>{t("services.ask")}</button></>}<ErrorNote error={d.error} /></aside>}</div></div>;
}
