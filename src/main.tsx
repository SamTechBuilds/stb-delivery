import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/young-serif/400.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./styles.css";
import { App } from "./App";

// Keep the token out of any URL the browser might send onward.
window.addEventListener("hashchange", () => window.location.reload());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
