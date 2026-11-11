import { useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, DownloadSimple, Eye } from "@phosphor-icons/react";
import { api, saveBlob } from "../api"; import { useT } from "../i18n"; import { useAuth } from "../auth"; import { Skeleton, ErrorNote } from "../ui";
const NO = /nominee|father|spouse|mother|branch|bank|relative|company|employer|guardian/i;
function autofill(f, user) {
  const l = f.label; if (f.type === "checkbox" || NO.test(l)) return "";
  if (/mobile|phone|\btel\b/i.test(l)) return user.profile.phone || "";
  if (/e-?mail/i.test(l)) return user.email || "";
  if (/name/i.test(l) && !/account|customer id|company/i.test(l) || /name of account holder/i.test(l)) return user.name || "";
  return "";
}
export default function FormReview({ draft }) {
  const { t } = useT(), { user } = useAuth(), skip = f => f.type === "signature" || f.type === "photo";
  const [vals, setVals] = useState(() => Object.fromEntries(draft.fields.filter(f => !skip(f)).map(f => [f.id, f.type === "checkbox" ? false : autofill(f, user)])));
  const [dx, setDx] = useState(0), [dy, setDy] = useState(0), [img, setImg] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const sections = [...new Set(draft.fields.filter(f => !skip(f)).map(f => f.section || ""))];
  const body = (x, y, preview) => ({ values: vals, dx: x, dy: y, preview });
  async function preview(x = dx, y = dy) { setBusy(true); setErr(null); try { setImg((await api.post(`/forms/${draft.draft_id}/fill`, body(x, y, true))).image); } catch (e) { setErr(e); } setBusy(false); }
  async function download() { setBusy(true); setErr(null); try { saveBlob(await api.postBlob(`/forms/${draft.draft_id}/fill`, body(dx, dy, false)), "StepFI_filled_form.pdf"); } catch (e) { setErr(e); } setBusy(false); }
  const nudge = (a, b) => { const x = dx + a, y = dy + b; setDx(x); setDy(y); preview(x, y); };
  const arrows = [[ArrowUp, 0, -2, "form.up"], [ArrowDown, 0, 2, "form.down"], [ArrowLeft, -2, 0, "form.left"], [ArrowRight, 2, 0, "form.right"]];
  return <div className="card flex w-full flex-col gap-4 p-4">
    <h3 className="title-1">{t("form.title")}: {draft.title}</h3>
    <div className="flex max-h-96 flex-col gap-4 overflow-auto pe-2">
      {sections.map(sec => <fieldset key={sec} className="flex flex-col gap-3">{sec && <legend className="body-4 text-brand">{sec}</legend>}
        {draft.fields.filter(f => !skip(f) && (f.section || "") === sec).map(f => f.type === "checkbox"
          ? <label key={f.id} className="flex items-center gap-2 body-6"><input type="checkbox" checked={!!vals[f.id]} onChange={e => setVals({ ...vals, [f.id]: e.target.checked })} />{f.label_local}</label>
          : <label key={f.id} className="flex flex-col gap-1"><span className="caption-1">{f.label_local}{f.label_local !== f.label && <span className="caption-5 text-mute"> · {f.label}</span>}</span>
            <input className={"input " + (f.type === "comb" ? "uppercase" : "")} maxLength={f.type === "comb" && f.cells ? f.cells : undefined} placeholder={f.type === "date" ? t("form.date") : ""} value={vals[f.id] || ""} onChange={e => setVals({ ...vals, [f.id]: e.target.value })} /></label>)}</fieldset>)}
    </div>
    {draft.fields.some(f => f.type === "signature") && <p className="caption-2 text-mute">{t("form.sign")}</p>}{draft.fields.some(f => f.type === "photo") && <p className="caption-2 text-mute">{t("form.photo")}</p>}
    <div className="flex flex-wrap items-center gap-2"><button type="button" className="btn btn-primary button-sm" disabled={busy} onClick={() => preview()}><Eye size={20} aria-hidden="true" />{t("form.preview")}</button>
      {img && arrows.map(([I, a, b, k]) => <button key={k} type="button" className="btn btn-ghost button-sm" aria-label={t(k)} title={t(k)} onClick={() => nudge(a, b)}><I size={20} aria-hidden="true" /></button>)}</div>
    {busy && !img && <Skeleton className="h-48 w-full" />}
    {img && <><img src={img} alt={draft.title} className="w-full rounded-xl border border-line" /><p className="caption-2 text-mute">{t("form.align")}</p>
      <button type="button" className="btn btn-primary button-md self-start" disabled={busy} onClick={download}><DownloadSimple size={20} aria-hidden="true" />{t("form.download")}</button></>}
    <p className="caption-2 text-mute">{t("form.note")}</p><ErrorNote error={err} /></div>;
}
