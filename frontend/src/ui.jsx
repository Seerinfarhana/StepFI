import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bank, Globe, MagnifyingGlass, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useT } from "./i18n";
export function useReveal() {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) { el.classList.add("in"); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return ref;
}
export function Reveal({ children, className = "", as: Tag = "div", ...p }) { const ref = useReveal(); return <Tag ref={ref} className={"reveal " + className} {...p}>{children}</Tag>; }
export function Logo({ to = "/" }) { const { t } = useT(); return <Link to={to} className="inline-flex items-center gap-2 title-2 text-brand"><Bank size={24} weight="duotone" aria-hidden="true" />{t("brand")}</Link>; }
export function Skeleton({ className = "h-4 w-full" }) { return <div className={"animate-pulse rounded-lg bg-mint " + className} aria-hidden="true" />; }
export function ErrorNote({ error }) { const { t } = useT(); return error ? <p role="alert" className="flex items-center gap-2 body-5 text-danger"><WarningCircle size={20} aria-hidden="true" />{t(error.detail || error)}</p> : null; }
export function Field({ label, error, children }) { return <label className="flex flex-col gap-1"><span className="caption-1 text-mute">{label}</span>{children}</label>; }
export function Chips({ value, onChange, options, prefix, label }) {
  const { t } = useT();
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">{options.map(o => <button type="button" key={o} aria-pressed={value === o} onClick={() => onChange(o)} className="chip caption-1">{t(prefix + o)}</button>)}</div>;
}
export function LanguageMenu() {
  const { t, lang, langs, setLang, loading, translated } = useT(), [open, setOpen] = useState(false), [q, setQ] = useState(""), ref = useRef();
  useEffect(() => { const f = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f); }, []);
  const cur = langs.find(l => l.code === lang);
  const list = langs.filter(l => (l.native + l.name).toLowerCase().includes(q.toLowerCase()));
  return <div ref={ref} className="relative">
    <button type="button" className="btn btn-ghost button-sm" aria-haspopup="listbox" aria-expanded={open} aria-label={t("nav.language")} onClick={() => setOpen(!open)}><Globe size={20} aria-hidden="true" />{cur ? cur.native : "English"}</button>
    {open && <div className="absolute end-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-card p-2">
      <div className="relative mb-2"><MagnifyingGlass size={16} className="absolute start-3 top-3 text-mute" aria-hidden="true" /><input className="input ps-8 body-6" placeholder={t("lang.search")} value={q} onChange={e => setQ(e.target.value)} aria-label={t("lang.search")} /></div>
      {loading && <Skeleton className="mb-2 h-2 w-full" />}
      <ul role="listbox" className="max-h-72 overflow-auto">{list.map(l => <li key={l.code}><button type="button" role="option" aria-selected={l.code === lang} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start body-5 hover:bg-mint" onClick={async () => { await setLang(l.code); setOpen(false); }}><span>{l.native}</span><span className="flex items-center gap-1 caption-4 text-mute">{l.name}{l.code === lang && <CheckCircle size={16} weight="fill" className="text-brand" />}</span></button></li>)}</ul>
      {!translated && <div className="flex flex-col items-start gap-2 p-2"><p className="caption-4 text-mute">{t("lang.notice")}</p><button type="button" className="btn btn-ghost button-xsm" disabled={loading} onClick={() => setLang(lang)}>{t("common.retry")}</button></div>}
    </div>}
  </div>;
}
