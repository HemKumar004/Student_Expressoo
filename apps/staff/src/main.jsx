import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@expressoo/shared/styles.css";
import { setTitleSuffix } from "@expressoo/shared";
import App from "./App.jsx";
import { api } from "./lib/api.js";

setTitleSuffix("Staff Portal · Student Expressoo");

const root = createRoot(document.getElementById("root"));

if (!api) {
  root.render(
    <div className="status-page">
      <div className="status-card">
        <p className="status-code">Configuration required</p>
        <h1 className="status-title">API address is not set</h1>
        <p className="status-text">
          Set <code>VITE_API_URL</code> in <code>apps/staff/.env</code> (or <code>.env.local</code>), then restart the dev server.
        </p>
      </div>
    </div>
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
