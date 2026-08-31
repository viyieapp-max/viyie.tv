import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { UserDataProvider } from "./hooks/useUserData";
import { BRAND_LOGO_URL, BRAND_NAME } from "./constants/brand";
import { initializeSecurity } from "./utils/security";

// Instantiate the Double Protection security suite (Network Encryption + DevTools countermeasures)
initializeSecurity();

// Monkeypatch JSON.stringify globally to prevent third-party scripts, devtools, and async logs
// from crashing the runtime when trying to safely stringify React synthetic events or Fiber Nodes.
const originalStringify = JSON.stringify;
JSON.stringify = function (obj: any, replacer?: any, space?: any) {
  try {
    return originalStringify(obj, replacer, space);
  } catch (err: any) {
    if (err.message && err.message.toLowerCase().includes("circular sequence") || err.message?.toLowerCase().includes("circular structure")) {
      const cache = new Set();
      return originalStringify(
        obj,
        (key, value) => {
          if (typeof value === "object" && value !== null) {
            // Drop DOM nodes / Events
            if (typeof Event !== "undefined" && value instanceof Event) return "[Event]";
            if (typeof Node !== "undefined" && value instanceof Node) return "[Node]";
            if (cache.has(value)) {
              return "[Circular]";
            }
            cache.add(value);
          }
          if (typeof replacer === "function") {
            return (replacer as any)(key, value);
          }
          return value;
        },
        space
      );
    }
    throw err;
  }
} as any;

function removeFallback() {
  const fb = document.getElementById("boot-fallback");
  if (!fb) return;

  fb.style.transition = "opacity 0.4s ease";
  fb.style.opacity = "0";
  setTimeout(() => fb.remove(), 420);
}

function mount() {
  const root = document.getElementById("root");
  if (!root) return;

  try {
    createRoot(root).render(
      <StrictMode>
        <UserDataProvider>
          <App />
        </UserDataProvider>
      </StrictMode>
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => removeFallback());
    });
  } catch (err) {
    console.error(`${BRAND_NAME} render error:`, err);
    removeFallback();
    root.innerHTML = `
      <div style="background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui;padding:20px;text-align:center">
        <div style="padding:24px 28px;border:1px solid rgba(255,255,255,.06);border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015));box-shadow:0 20px 60px rgba(0,0,0,.55)">
          <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" style="height:64px;width:auto;object-fit:contain;margin:0 auto 14px;filter:drop-shadow(0 10px 26px rgba(249,115,22,.35))" />
          <h1 style="font-size:22px;font-weight:900;margin-bottom:10px">${BRAND_NAME}</h1>
          <p style="color:rgba(255,255,255,0.55);margin-bottom:16px;font-size:14px">An error occurred. Please refresh the page.</p>
          <button onclick="location.reload()" style="background:linear-gradient(to right,#dc2626,#f97316);color:#fff;border:none;padding:10px 24px;border-radius:12px;font-weight:700;cursor:pointer">Refresh</button>
        </div>
      </div>`;
  }
}

// Wait for DOM to be ready before mounting
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
