import { Routes, Route, Navigate } from "react-router-dom";
import { useT } from "./i18n"; import { useAuth } from "./auth"; import { Skeleton } from "./ui";
import Landing from "./pages/Landing"; import { LanguagePage, Login, ChooseRole, RegisterCustomer, RegisterAdmin, Verify } from "./pages/Auth";
import { CustomerLayout, Home, Loans, Services } from "./pages/Customer"; import Assistant from "./pages/Assistant"; import Admin from "./pages/Admin"; import { NotFound, Legal } from "./pages/Misc";
const First = ({ children }) => localStorage.getItem("lang") ? children : <Navigate to="/language" replace />;
function Guard({ role, children }) {
  const { user, ready } = useAuth(); if (!ready) return <div className="mx-auto max-w-md p-8"><Skeleton className="h-24 w-full" /></div>;
  if (!user) return <Navigate to="/login" replace />; if (user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/app/home"} replace />; return children;
}
export default function App() {
  const { failed, retry, loading, strings, t } = useT();
  if (failed && !Object.keys(strings || {}).length) return <main className="mx-auto max-w-md p-8"><h1 className="heading-5">Cannot reach the StepFI server</h1><p className="body-6 mt-2 text-mute">Start the backend (see README) and try again.</p><button className="btn btn-primary button-md mt-4" onClick={retry}>Try again</button></main>;
  if (loading && !Object.keys(strings || {}).length) return <div className="mx-auto max-w-md p-8"><Skeleton className="h-24 w-full" /></div>;
  return <>{loading && <div className="fixed inset-x-0 top-0 z-50 h-1 animate-pulse bg-brand" role="status" aria-label={t("lang.loading")} />}<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
    <Routes>
      <Route path="/" element={<First><Landing /></First>} /><Route path="/language" element={<LanguagePage />} /><Route path="/login" element={<Login />} />
      <Route path="/register" element={<ChooseRole />} /><Route path="/register/customer" element={<RegisterCustomer />} /><Route path="/register/admin" element={<RegisterAdmin />} /><Route path="/verify" element={<Verify />} />
      <Route path="/app" element={<Guard role="customer"><CustomerLayout /></Guard>}><Route index element={<Navigate to="home" replace />} /><Route path="home" element={<Home />} /><Route path="loans" element={<Loans />} /><Route path="assistant" element={<Assistant />} /><Route path="services" element={<Services />} /></Route>
      <Route path="/admin" element={<Guard role="admin"><Admin /></Guard>} />
      <Route path="/privacy" element={<Legal kind="p" />} /><Route path="/terms" element={<Legal kind="t" />} /><Route path="*" element={<NotFound />} />
    </Routes></>;
}
