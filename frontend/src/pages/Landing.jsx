import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { List, Translate, Receipt, Bank, Camera, FilePdf, CaretDown, ShieldCheck } from "@phosphor-icons/react";
import { useT } from "../i18n"; import { useAuth } from "../auth"; import { api } from "../api"; import { Logo, LanguageMenu, Reveal, Skeleton } from "../ui";
function Nav() {
  const { t } = useT(), { user } = useAuth(), [open, setOpen] = useState(false), [shown, setShown] = useState(false);
  const links = [["#how", t("nav.how")], ["#benefits", t("nav.benefits")], ["#faq", t("nav.faq")]];
  const dash = user ? (user.role === "admin" ? "/admin" : "/app/home") : null;
  useEffect(() => { if (!open) { setShown(false); return; } const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, [open]);
  const line = (y, r) => ({ top: 11, transform: open ? `rotate(${r}deg)` : `translateY(${y}px)` });
  return <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
    <nav aria-label="Main" className="relative z-40 flex w-max max-w-full items-center gap-4 rounded-2xl border border-line bg-white/70 px-4 py-2 backdrop-blur-md">
      <Logo />
      <ul className="hidden items-center gap-4 md:flex">{links.map(([h, l]) => <li key={h}><a href={h} className="body-5 text-mute hover:text-ink">{l}</a></li>)}</ul>
      <LanguageMenu />
      {dash ? <Link to={dash} className="btn btn-primary button-sm hidden md:inline-flex">{t("nav.dashboard")}</Link> : <>
        <Link to="/login" className="btn btn-ghost button-sm hidden md:inline-flex">{t("nav.signin")}</Link>
        <Link to="/register" className="btn btn-primary button-sm hidden md:inline-flex">{t("nav.start")}</Link></>}
      <button type="button" className="relative h-6 w-6 md:hidden" aria-label={open ? t("nav.close") : t("nav.menu")} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="bar-line" style={line(-4, 45)} /><span className="bar-line" style={line(4, -45)} /></button>
    </nav>
    {open && <div className={"fixed inset-0 z-30 flex flex-col gap-6 bg-page/95 px-6 pt-24 backdrop-blur-xl md:hidden " + (shown ? "menu-open" : "")}>
      {[...links, ...(dash ? [[dash, t("nav.dashboard")]] : [["/login", t("nav.signin")], ["/register", t("nav.start")]])].map(([h, l], i) =>
        <a key={h} href={h} onClick={() => setOpen(false)} className="menu-item heading-5" style={{ transitionDelay: Math.min(i * 60, 400) + "ms" }}>{l}</a>)}
    </div>}
  </header>;
}
function Tagline({ text }) {
  const ref = useRef();
  useEffect(() => {
    const els = [...ref.current.querySelectorAll("[data-w]")];
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) { els.forEach(e => e.classList.add("on")); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -35% 0px" });
    els.forEach(e => io.observe(e)); return () => io.disconnect();
  }, [text]);
  return <p ref={ref} className="heading-3 md:heading-2 mx-auto max-w-4xl text-center">{text.split(" ").map((w, i) => <span key={i} data-w className="tw" style={{ transitionDelay: (i % 8) * 40 + "ms" }}>{w} </span>)}</p>;
}
export default function Landing() {
  const { t } = useT(), { user } = useAuth(), [s, setS] = useState(null);
  useEffect(() => { api.get("/stats/public").then(setS).catch(() => {}); }, []);
  const stats = [["languages", s?.languages], ["services", s?.services], ["loans", s?.loans]];
  const cta = user ? (user.role === "admin" ? "/admin" : "/app/home") : "/register";
  const icons = [Translate, Receipt, Bank, Camera];
  return <>
    <Nav />
    <main id="main">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-24 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h1 className="hero-grad heading-3 md:heading-1 max-w-[680px]">{t("hero.title")}</h1>
          <p className="body-3 max-w-[680px] text-mute">{t("hero.sub")}</p>
          <div><Link to={cta} className="btn btn-primary button-lg">{t("hero.cta")}</Link></div>
          <dl className="flex flex-wrap gap-6">{stats.map(([k, v]) => <div key={k}><dt className="caption-2 text-mute">{t("proof." + k)}</dt><dd className="heading-5">{v ?? <Skeleton className="mt-1 h-6 w-12" />}</dd></div>)}</dl>
        </div>
        <div className="card flex flex-col gap-4" aria-label="Example conversation">
          <p className="self-end rounded-2xl bg-peach px-4 py-3 body-6">{t("demo.q")}</p>
          <p className="rounded-2xl border border-line px-4 py-3 body-6">{t("demo.a")}</p>
          <div className="flex items-center gap-3 rounded-xl bg-mint px-4 py-3"><FilePdf size={32} className="text-brand" aria-hidden="true" /><div><p className="body-4">{t("demo.form")}</p><p className="caption-5 text-mute">{t("demo.note")}</p></div></div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-20">
        <Reveal><h2 className="heading-4 md:heading-2 max-w-[680px]">{t("problem.title")}</h2><p className="body-3 mt-4 max-w-[680px] text-mute">{t("problem.lead")}</p></Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">{[1, 2, 3].map(i => <Reveal key={i} className="card"><h3 className="title-1">{t(`problem.p${i}t`)}</h3><p className="body-6 mt-2 text-mute">{t(`problem.p${i}`)}</p></Reveal>)}</div>
        <Reveal><p className="title-1 mt-10 max-w-[680px]">{t("problem.solution")}</p></Reveal>
      </section>
      <section id="benefits" className="mx-auto max-w-6xl px-4 py-20">
        <Reveal><h2 className="heading-4 md:heading-2">{t("benefits.title")}</h2></Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">{[1, 2, 3, 4].map((i, k) => { const I = icons[k]; return <Reveal key={i} className="card flex gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mint"><I size={24} className="text-brand" aria-hidden="true" /></span><div><h3 className="title-1">{t(`benefits.b${i}t`)}</h3><p className="body-6 mt-1 text-mute">{t(`benefits.b${i}`)}</p></div></Reveal>; })}</div>
      </section>
      <section id="how" className="mx-auto max-w-6xl px-4 py-20">
        <Reveal><h2 className="heading-4 md:heading-2">{t("how.title")}</h2></Reveal>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">{[1, 2, 3].map(i => <Reveal as="li" key={i} className="card"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand body-4 text-white">{i}</span><h3 className="title-1 mt-4">{t(`how.s${i}t`)}</h3><p className="body-6 mt-2 text-mute">{t(`how.s${i}`)}</p></Reveal>)}</ol>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-20">
        <Reveal className="card"><h2 className="heading-5">{t("proof.title")}</h2><dl className="mt-6 flex flex-wrap gap-12">{stats.map(([k, v]) => <div key={k}><dd className="heading-3">{v ?? "…"}</dd><dt className="body-6 text-mute">{t("proof." + k)}</dt></div>)}</dl><p className="caption-2 mt-6 text-mute">{t("proof.note")}</p></Reveal>
      </section>
      <section className="bg-card px-4 py-24" aria-label="Tagline"><Tagline text={t("tagline.text")} /></section>
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
        <Reveal><h2 className="heading-4 md:heading-2">{t("faq.title")}</h2></Reveal>
        <div className="mt-10 flex flex-col gap-3">{[1, 2, 3, 4, 5, 6, 7].map(i => <Reveal as="details" key={i} className="card group"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 title-3">{t(`faq.q${i}`)}<CaretDown size={20} className="shrink-0 transition-transform duration-500 ease-base group-open:rotate-180" aria-hidden="true" /></summary><p className="body-6 mt-3 text-mute">{t(`faq.a${i}`)}</p></Reveal>)}</div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12"><Reveal className="card flex items-start gap-4"><ShieldCheck size={32} className="shrink-0 text-brand" aria-hidden="true" /><div><h2 className="heading-6">{t("risk.title")}</h2><p className="body-6 mt-1 text-mute">{t("risk.text")}</p></div></Reveal></section>
      <section className="mx-auto max-w-6xl px-4 py-20 text-center"><Reveal><h2 className="heading-4 md:heading-2 mx-auto max-w-[680px]">{t("cta.title")}</h2><div className="mt-8"><Link to={cta} className="btn btn-primary button-lg">{t("cta.btn")}</Link></div></Reveal></section>
    </main>
    <footer className="border-t border-line"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8"><Logo /><div className="flex gap-6 body-6 text-mute"><Link to="/privacy">{t("footer.privacy")}</Link><Link to="/terms">{t("footer.terms")}</Link></div><p className="caption-2 text-mute">{t("footer.rights")}</p></div></footer>
  </>;
}
