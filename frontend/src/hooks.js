import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
export function useData(path) {
  const [s, setS] = useState({ data: null, error: null, loading: !!path });
  const load = useCallback(() => {
    if (!path) { setS({ data: null, error: null, loading: false }); return; }
    setS(o => ({ ...o, loading: true, error: null }));
    api.get(path).then(d => setS({ data: d, error: null, loading: false })).catch(e => setS({ data: null, error: e, loading: false }));
  }, [path]);
  useEffect(load, [load]);
  return { ...s, reload: load };
}
export const inr = n => "₹" + new Intl.NumberFormat("en-IN").format(n);
