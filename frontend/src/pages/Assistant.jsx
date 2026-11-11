import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Camera, PaperPlaneRight, ThumbsUp, ThumbsDown, FilePdf, X, DownloadSimple, Plus, Microphone, Stop, SpeakerHigh } from "@phosphor-icons/react";
import { api, saveBlob } from "../api"; import { useT } from "../i18n"; import { useData } from "../hooks"; import { Skeleton, ErrorNote, Chips } from "../ui";
import { sttSupported, listen, speak, stopSpeaking } from "../voice"; import FormReview from "./FormReview";
async function shrink(file) {
  const bmp = await createImageBitmap(file), s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
}
export default function Assistant() {
  const { t, lang } = useT(), loc = useLocation(), [sp, setSp] = useSearchParams(), opts = useData("/options").data;
  const [msgs, setMsgs] = useState([]), [chatId, setChatId] = useState(null), [text, setText] = useState(""), [img, setImg] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const [listening, setListening] = useState(false), [auto, setAuto] = useState(localStorage.getItem("autoRead") === "1");
  const end = useRef(), file = useRef(), started = useRef(false), rec = useRef();
  useEffect(() => { const id = sp.get("chat"); if (id) api.get(`/chats/${id}/messages`).then(r => { setChatId(+id); setMsgs(r.map(m => ({ ...m, rated: m.rating }))); }).catch(setErr); return () => { stopSpeaking(); rec.current && rec.current.stop(); }; }, []);
  useEffect(() => { if (loc.state?.q && !started.current) { started.current = true; send(loc.state.q); } }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  const say = m => { const r = speak(m.text, lang); if (r === "novoice" || r === "unsupported") setErr({ detail: "chat.noVoice" }); };
  async function send(q = text) {
    q = (q || "").trim(); if ((!q && !img) || busy) return;
    setErr(null); setBusy(true); const sent = img; setImg(null); setText("");
    setMsgs(m => [...m, { id: "u" + Date.now(), role: "user", text: q || t("chat.photo"), preview: sent?.url }]);
    try {
      if (sent) {   // a photo is a form: read it, let the customer fill it, then write on the original
        const fd = new FormData(); fd.append("lang", lang); fd.append("image", sent.blob, "form.jpg");
        const d = await api.form("/forms/analyze", fd); setMsgs(m => [...m, { id: "f" + d.draft_id, role: "assistant", kind: "form", draft: d, text: t("form.ready") }]);
      } else {
        const fd = new FormData(); fd.append("message", q); fd.append("lang", lang); if (chatId) fd.append("chat_id", chatId);
        const r = await api.form("/chat", fd); setChatId(r.chat_id); setMsgs(m => [...m, { id: r.message_id, role: "assistant", text: r.text, form_id: r.form_id }]);
        if (auto) speak(r.text, lang);
      }
    } catch (e) { setErr(e); }
    setBusy(false);
  }
  function mic() {
    if (!sttSupported()) return setErr({ detail: "chat.noMic" });
    if (listening) { rec.current && rec.current.stop(); return; }
    stopSpeaking(); setErr(null); setListening(true);
    rec.current = listen(lang, { onResult: (txt, fin) => { setText(txt); if (fin) setTimeout(() => send(txt), 300); }, onEnd: () => setListening(false), onError: () => { setListening(false); setErr({ detail: "chat.micError" }); } });
  }
  async function rate(m, rating, reason) {
    try { await api.post("/feedback", { message_id: m.id, rating, reason: reason || null }); setMsgs(ms => ms.map(x => x.id === m.id ? { ...x, rated: rating, reason: reason || (rating === "like" ? null : x.reason) } : x)); } catch (e) { setErr(e); }
  }
  async function download(m) { try { saveBlob(await api.blob(`/forms/${m.form_id}/pdf`), "StepFI_form.pdf"); } catch (e) { setErr(e); } }
  async function pick(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { const blob = await shrink(f); setImg({ blob, url: URL.createObjectURL(blob) }); } catch { setErr({ detail: "err.image" }); } }
  const reset = () => { setMsgs([]); setChatId(null); setImg(null); setErr(null); setSp({}); stopSpeaking(); };
  const toggleAuto = () => { const v = !auto; setAuto(v); localStorage.setItem("autoRead", v ? "1" : "0"); if (!v) stopSpeaking(); };
  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="heading-4">{t("chat.title")}</h1>
      <div className="flex items-center gap-2"><button type="button" className="chip caption-1" aria-pressed={auto} onClick={toggleAuto}><SpeakerHigh size={16} className="inline" aria-hidden="true" /> {t("chat.autoRead")}</button>
        <button type="button" className="btn btn-ghost button-sm" onClick={reset}><Plus size={16} aria-hidden="true" />{t("chat.new")}</button></div></div>
    <div className="card flex min-h-[420px] flex-col gap-4" aria-live="polite">
      {!msgs.length && !busy && <div className="flex flex-col gap-3"><p className="body-6 text-mute">{t("chat.hint")}</p><div className="flex flex-wrap gap-2">{[1, 2, 3, 4].map(i => <button key={i} type="button" className="chip caption-1 text-start" onClick={() => send(t("chat.p" + i))}>{t("chat.p" + i)}</button>)}</div></div>}
      {msgs.map(m => m.role === "user"
        ? <div key={m.id} className="flex max-w-[80%] flex-col items-end gap-2 self-end">{m.preview && <img src={m.preview} alt={t("chat.photo")} className="max-h-40 rounded-xl border border-line" />}<p className="whitespace-pre-wrap rounded-2xl bg-peach px-4 py-3 body-6">{m.text}</p></div>
        : m.kind === "form"
          ? <div key={m.id} className="flex w-full flex-col items-start gap-2"><p className="rounded-2xl border border-line px-4 py-3 body-6">{m.text}</p><FormReview draft={m.draft} /></div>
          : <div key={m.id} className="flex max-w-[85%] flex-col items-start gap-2"><p className="whitespace-pre-wrap rounded-2xl border border-line px-4 py-3 body-6">{m.text}</p>
            <div className="flex flex-wrap items-center gap-2"><button type="button" className="chip caption-4" onClick={() => say(m)}><SpeakerHigh size={16} className="inline" aria-hidden="true" /> {t("chat.listen")}</button>
              {m.form_id && <button type="button" className="btn btn-primary button-sm" onClick={() => download(m)}><FilePdf size={20} aria-hidden="true" />{t("chat.download")}<DownloadSimple size={16} aria-hidden="true" /></button>}</div>
            {typeof m.id === "number" && <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="chip caption-4" aria-pressed={m.rated === "like"} onClick={() => rate(m, "like")}><ThumbsUp size={16} className="inline" aria-hidden="true" /> {t("chat.helpful")}</button>
              <button type="button" className="chip caption-4" aria-pressed={m.rated === "dislike"} onClick={() => rate(m, "dislike", m.reason)}><ThumbsDown size={16} className="inline" aria-hidden="true" /> {t("chat.notHelpful")}</button></div>}
            {m.rated === "dislike" && opts && <div><p className="caption-4 mb-1 text-mute">{t("chat.reason")}</p><Chips label={t("chat.reason")} value={m.reason} onChange={r => rate(m, "dislike", r)} options={opts.reasons} prefix="reason." /></div>}</div>)}
      {busy && <div className="flex max-w-[60%] flex-col gap-2" role="status"><span className="sr-only">{t(img ? "form.reading" : "chat.thinking")}</span><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-40" /></div>}
      <ErrorNote error={err} /><div ref={end} /></div>
    {img && <div className="flex items-center gap-3"><img src={img.url} alt={t("chat.photo")} className="h-16 rounded-lg border border-line" /><button type="button" className="btn btn-ghost button-sm" onClick={() => setImg(null)}><X size={16} aria-hidden="true" />{t("chat.remove")}</button></div>}
    <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); send(); }}>
      <button type="button" className="btn btn-ghost" aria-label={t("chat.camera")} title={t("chat.camera")} onClick={() => file.current.click()}><Camera size={24} aria-hidden="true" /></button>
      <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <button type="button" className={"btn " + (listening ? "btn-primary" : "btn-ghost")} aria-pressed={listening} aria-label={t(listening ? "chat.micStop" : "chat.mic")} title={t(listening ? "chat.micStop" : "chat.mic")} onClick={mic}>{listening ? <Stop size={24} aria-hidden="true" /> : <Microphone size={24} aria-hidden="true" />}</button>
      <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder={listening ? t("chat.listening") : t("chat.placeholder")} aria-label={t("chat.placeholder")} />
      <button className="btn btn-primary" disabled={busy} aria-label={t("chat.send")}><PaperPlaneRight size={24} aria-hidden="true" /></button></form></div>;
}
