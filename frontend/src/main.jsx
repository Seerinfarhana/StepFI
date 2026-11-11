import React from "react"; import { createRoot } from "react-dom/client"; import { BrowserRouter } from "react-router-dom";
import "@fontsource/manrope/400.css"; import "@fontsource/manrope/500.css"; import "@fontsource/manrope/600.css";
import "./index.css"; import App from "./App"; import { LangProvider } from "./i18n"; import { AuthProvider } from "./auth";
createRoot(document.getElementById("root")).render(<BrowserRouter><LangProvider><AuthProvider><App /></AuthProvider></LangProvider></BrowserRouter>);
