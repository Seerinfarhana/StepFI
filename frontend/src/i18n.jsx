import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";
const Ctx = createContext();
export function LangProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem("lang") || "en"), [strings, setStrings] = useState({}), [loading, setLoading] = useState(true), [translated, setTranslated] = useState(true), [langs, setLangs] = useState([]), [failed, setFailed] = useState(false);
  const load = useCallback(async l => {
    setLoading(true);
    try { const r = await api.get("/i18n/" + l); setStrings(r.strings); setTranslated(r.translated); setLang(l); setFailed(false); localStorage.setItem("lang", l); document.documentElement.lang = l; document.documentElement.dir = r.dir; }
    catch { setFailed(true); }
    setLoading(false);
  }, []);
  useEffect(() => { load(lang); api.get("/languages").then(setLangs).catch(() => {}); }, []);
  const t = useCallback(k => strings[k] ?? k, [strings]);
  return <Ctx.Provider value={{ lang, t, strings, setLang: load, loading, translated, langs, failed, retry: () => load(lang) }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
