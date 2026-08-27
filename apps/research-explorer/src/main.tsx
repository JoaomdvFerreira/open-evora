import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "@fontsource/source-serif-4/latin-ext-400.css";
import "@fontsource/source-serif-4/latin-ext-600.css";
import "@fontsource/source-serif-4/latin-ext-700.css";
import "@fontsource/ibm-plex-mono/latin-ext-400.css";
import "@fontsource/ibm-plex-mono/latin-ext-500.css";
import { App } from "./app/App";
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element "#root" not found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
