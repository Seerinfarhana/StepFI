import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
const A = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false);
  useEffect(() => { if (!localStorage.getItem("token")) return setReady(true); api.get("/auth/me").then(setUser).catch(() => localStorage.removeItem("token")).finally(() => setReady(true)); }, []);
  const signIn = (token, u) => { localStorage.setItem("token", token); setUser(u); };
  const signOut = () => { localStorage.removeItem("token"); setUser(null); };
  return <A.Provider value={{ user, ready, signIn, signOut }}>{children}</A.Provider>;
}
export const useAuth = () => useContext(A);
