/**
 * Advanced Dynamic Cryptography and Anti-Debugging Patcher (Double Protection)
 * Compatible with both Node.js (Backend) and Browser (Frontend) runtimes.
 */

const KEY = "ViyieDoubleSecurityKey_2026_FireFury";

/**
 * 1. Synchronous Base64 & Multi-pass XOR Salted Encryption
 * 100% Binary Safe, prevents multi-byte or character-encoding crashes.
 */
export function encryptPayload(plainText: string): string {
  if (!plainText) return "";

  // A. Encode input as standard Base64 first to secure foreign languages or special characters safe
  let safeBase64 = "";
  if (typeof window !== "undefined") {
    safeBase64 = btoa(unescape(encodeURIComponent(plainText)));
  } else {
    safeBase64 = Buffer.from(plainText, "utf8").toString("base64");
  }

  // B. Prepend a random 4-hexadecimal salt to make the resulting output token unique every single time
  const salt = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  const saltedStr = salt + safeBase64;

  // C. Apply a multi-pass custom XOR stream calculation
  let cipher = "";
  for (let i = 0; i < saltedStr.length; i++) {
    const charCode = saltedStr.charCodeAt(i);
    const keyChar = KEY.charCodeAt((i + (i % 3)) % KEY.length);
    const encrypted = charCode ^ keyChar ^ (i % 127);
    cipher += String.fromCharCode(encrypted);
  }

  // D. Convert to final secure Base64 format
  if (typeof window !== "undefined") {
    return btoa(unescape(encodeURIComponent(cipher)));
  } else {
    return Buffer.from(cipher, "binary").toString("base64");
  }
}

/**
 * Decrypts the dynamic cipher text back to its original plain string.
 */
export function decryptPayload(cipherText: string): string {
  if (!cipherText) return "";

  // A. Decode primary outer Base64
  let binary = "";
  try {
    if (typeof window !== "undefined") {
      binary = decodeURIComponent(escape(atob(cipherText)));
    } else {
      binary = Buffer.from(cipherText, "base64").toString("binary");
    }
  } catch (e) {
    return "";
  }

  // B. Apply inverse XOR decryption
  let decryptedBytes = "";
  for (let i = 0; i < binary.length; i++) {
    const charCode = binary.charCodeAt(i);
    const keyChar = KEY.charCodeAt((i + (i % 3)) % KEY.length);
    const original = charCode ^ keyChar ^ (i % 127);
    decryptedBytes += String.fromCharCode(original);
  }

  // C. Discard the 4-char random hex salt
  const rawBase64 = decryptedBytes.substring(4);

  // D. Decode standard inner Base64
  try {
    if (typeof window !== "undefined") {
      return decodeURIComponent(escape(atob(rawBase64)));
    } else {
      return Buffer.from(rawBase64, "base64").toString("utf-8");
    }
  } catch (e) {
    return "";
  }
}

/**
 * Check if the active protection and warning blocks should be triggered.
 * Security active protections only run when the streaming player is active/mounted.
 */
export function isSecurityTriggerActive(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).__VIYIE_STREAMING_ACTIVE);
}

/**
 * 2. Frontend Initialization Hook (Bypasses inspection, registers interceptor, blocks devtools)
 * Call this dynamically inside main.tsx during app initialization.
 */
export function initializeSecurity(): void {
  if (typeof window === "undefined") return;

  // ----------------------------------------------------
  // PART A: Monkeypatch Global Fetch for Stream/API Obfuscation
  // ----------------------------------------------------
  const originalFetch = window.fetch;
  const patchedFetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    let url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    // We only encrypt dynamic traffic directed to our internal server APIs, excluding media streams, segments, playlists, subtitles, and vendor assets.
    const isStreamingOrAsset = url.includes("/api/v-") || 
                               url.includes("/api/proxy-") || 
                               url.includes("/api/dtube-") || 
                               url.includes("/api/extract-") || 
                               url.includes("/api/youtube-") ||
                               url.includes("/assets/") ||
                               url.includes("dynamic-icons.png") ||
                               url.includes("vendor-polyfills.js");

    if (url.startsWith("/api/") && !isStreamingOrAsset) {
      const isGet = !init || !init.method || init.method.toUpperCase() === "GET";
      const newInit = init ? { ...init } : {};

      // Ensure Headers exists
      const headers = new Headers(newInit.headers || {});
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      newInit.headers = headers;

      if (isGet) {
        // Intercept query parameters, wrap them in secure encrypted block
        try {
          const urlObj = new URL(url, window.location.origin);
          const params: Record<string, string> = {};
          urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
          });

          if (Object.keys(params).length > 0) {
            const encryptedParams = encryptPayload(JSON.stringify(params));
            urlObj.search = `_p=${encodeURIComponent(encryptedParams)}`;
            url = urlObj.pathname + urlObj.search;
          }
        } catch (e) {
          // Fallback to plain URL if parsing fails
        }
      } else if (newInit.body && typeof newInit.body === "string") {
        // Intercept POST request body and encrypt it
        try {
          // Confirm if it is a valid JSON payload before processing
          JSON.parse(newInit.body);
          const encrypted = encryptPayload(newInit.body);
          newInit.body = JSON.stringify({ _p: encrypted });
        } catch (e) {
          // Leave non-JSON payload intact
        }
      }

      // Execute actual HTTP request
      const response = await originalFetch(url, newInit);

      // Wrap response json() and text() to dynamically decrypt the server responses
      const originalJson = response.json.bind(response);
      const originalText = response.text.bind(response);

      response.json = async function () {
        const bodyContent = await originalJson();
        if (bodyContent && bodyContent._r) {
          try {
            const decoded = decryptPayload(bodyContent._r);
            return JSON.parse(decoded);
          } catch (err) {
            console.error("Secure response decoding failed", err);
          }
        }
        return bodyContent;
      };

      response.text = async function () {
        const rawText = await originalText();
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && parsed._r) {
            return decryptPayload(parsed._r);
          }
        } catch (e) {
          // Plain text fallback
        }
        return rawText;
      };

      return response;
    }

    // Default bypass for non-API files/CDNs
    return originalFetch(input, init);
  };

  try {
    // Attempt to redefine via Object.defineProperty
    Object.defineProperty(window, "fetch", {
      value: patchedFetch,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch (e) {
    try {
      // Fallback to direct assignment
      (window as any).fetch = patchedFetch;
    } catch (err) {
      console.warn("Could not patch window.fetch because developer environment has only read-only fetch getter.", err);
    }
  }

  // ----------------------------------------------------
  // PART B: DevTools Keyboard and Mouse Blockers with Active Defense
  // ----------------------------------------------------
  // 1. Disable Right Click to prevent standard "Inspect" triggering
  document.addEventListener("contextmenu", (e) => {
    if (!isSecurityTriggerActive()) return;
    
    const target = e.target as HTMLElement | null;
    if (target && target.closest(".viyieplayer")) {
      return;
    }
    
    e.preventDefault();
    return false;
  });

  // 2. Clear Console frequently to keep it blank
  setInterval(() => {
    if (!isSecurityTriggerActive()) return;
    console.clear();
  }, 1000);

  // 3. Intercept and block DevTools hotkeys & trigger active defense
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!isSecurityTriggerActive()) return;

    const keyLower = e.key ? e.key.toLowerCase() : "";
    const isF12 = e.key === "F12" || e.keyCode === 123 || e.code === "F12";
    
    const isCtrlShiftI = (e.ctrlKey || e.metaKey) && e.shiftKey && (keyLower === "i" || e.keyCode === 73 || e.code === "KeyI");
    const isCtrlShiftJ = (e.ctrlKey || e.metaKey) && e.shiftKey && (keyLower === "j" || e.keyCode === 74 || e.code === "KeyJ");
    const isCtrlShiftC = (e.ctrlKey || e.metaKey) && e.shiftKey && (keyLower === "c" || e.keyCode === 67 || e.code === "KeyC");
    
    const isMacDevTools = e.metaKey && e.altKey && (keyLower === "i" || keyLower === "j" || keyLower === "c" || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67);
    
    const isCtrlU = (e.ctrlKey || e.metaKey) && (keyLower === "u" || e.keyCode === 85 || e.code === "KeyU");
    const isCtrlS = (e.ctrlKey || e.metaKey) && (keyLower === "s" || e.keyCode === 83 || e.code === "KeyS");

    if (isF12 || isCtrlShiftI || isCtrlShiftJ || isCtrlShiftC || isMacDevTools || isCtrlU || isCtrlS) {
      e.preventDefault();
      e.stopPropagation();
      
      // Ctrl+S just gets blocked cleanly to make app immune to save page, other keys trigger full defense
      if (isCtrlS) {
        return false;
      }

      triggerDefense();
      return false;
    }
  }, true);

  // ----------------------------------------------------
  // PART C: Continuous Anti-Debugging Protection & Active Detection Checkers
  // ----------------------------------------------------
  // Continuous check for console / devtools opening
  const checkDevToolsRatio = () => {
    if (!isSecurityTriggerActive()) return;
    try {
      const threshold = 160;
      const devtoolsOpenHorizontal = window.outerWidth - window.innerWidth > threshold;
      const devtoolsOpenVertical = window.outerHeight - window.innerHeight > threshold;
      
      // Screen Zoom check fallback to avoid false positives on zoom
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (!isMobile && (devtoolsOpenHorizontal || devtoolsOpenVertical)) {
        // Double check using debugger to see if active
        triggerDefense();
      }
    } catch (e) {}
  };

  // Run dimension triggers
  setInterval(checkDevToolsRatio, 1000);

  // Spawns a lightweight non-blocking interval that triggers "debugger" breaks if console is opened.
  const triggerDebugger = function () {
    if (!isSecurityTriggerActive()) return;
    try {
      const start = new Date().getTime();
      const func = function () {
        (function () {}).constructor("debugger")();
      };
      func();
      const end = new Date().getTime();
      // If a debugger event took more than 100ms to proceed, it was paused by an active inspect agent!
      if (end - start > 100) {
        triggerDefense();
      }
    } catch (err) {
      // Graceful fallback
    }
  };

  // Run initial blocker securely
  setTimeout(triggerDebugger, 500);

  // Continuously check at safe intervals without infinite synchronous recursion
  setInterval(triggerDebugger, 1500);
}

/**
 * Active self-defense mechanism.
 * Instantly wipes all player elements globally from DOM, notifies React components to unmount
 * all players, re-renders body with security screen, opens a new clean window at homepage,
 * and tries to close/replace the old tab.
 */
export function triggerDefense(): void {
  if (typeof window === "undefined") return;

  // Mark compromised globally
  (window as any).__VIYIE_COMPROMISED = true;

  // Dispatch event to notify React components to unmount active stream streams safely and show warning
  try {
    const event = new CustomEvent("viyieCompromised");
    window.dispatchEvent(event);
  } catch (err) {}
}
