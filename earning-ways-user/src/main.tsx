import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * Dev preview (design S1): the session is seeded before render so `/app/*` opens even without
 * a database. When the flag is off, this import is not even loaded.
 */
if (import.meta.env.DEV && import.meta.env.VITE_DEV_PREVIEW === "true") {
  const { installPreviewSession } = await import("@/dev/preview");
  installPreviewSession();
}

createRoot(document.getElementById("root")!).render(<App />);
