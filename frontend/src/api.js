async function req(path, opt = {}) {
  const h = { ...(opt.headers || {}) }, tk = localStorage.getItem("token"); if (tk) h.Authorization = "Bearer " + tk;
  let r; try { r = await fetch("/api" + path, { ...opt, headers: h }); } catch { throw { detail: "err.network" }; }
  if (!r.ok) {
    let d = "err.network"; try { d = (await r.json()).detail || d; } catch {}
    if (r.status === 401 && tk && !path.startsWith("/auth/")) { localStorage.removeItem("token"); window.location.assign("/login"); }
    throw { status: r.status, detail: typeof d === "string" ? d : "err.network" };
  }
  return opt.blob ? r.blob() : r.json();
}
export const api = {
  get: p => req(p),
  post: (p, b) => req(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }),
  form: (p, fd) => req(p, { method: "POST", body: fd }),
  blob: p => req(p, { blob: true }),
  postBlob: (p, b) => req(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b), blob: true }),
};
export function saveBlob(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); }
