import { env } from "../line-bot/config/env";

export const liffHubStyles = `
    :root {
      color-scheme: dark;
      --bg: #0f172a;
      --accent: #3b82f6;
      --text: #f8fafc;
      --muted: #94a3b8;
      --card: #1e293b;
      --border: #334155;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "PingFang TC", "Noto Sans TC", sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 1.25rem;
    }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 1rem; }
    a { color: var(--accent); text-decoration: none; }
    .card {
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 0.75rem;
      background: var(--card);
    }
    .card h3 { margin: 0 0 0.35rem; font-size: 0.95rem; }
    .card p { margin: 0; font-size: 0.85rem; color: var(--muted); }
    button, .btn {
      display: inline-block;
      width: 100%;
      padding: 0.75rem;
      border: none;
      border-radius: 0.5rem;
      background: var(--accent);
      color: #fff;
      font-weight: 600;
      font-size: 0.95rem;
      text-align: center;
      cursor: pointer;
    }
    button.secondary, .btn.secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      margin-top: 0.5rem;
    }
    #status { margin-top: 1rem; font-size: 0.8rem; color: var(--muted); word-break: break-all; }
    .hidden { display: none !important; }
    .setup {
      border: 1px dashed var(--border);
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
`;

export function renderLiffClientScript(liffId: string): string {
  return `
    const liffId = ${JSON.stringify(liffId)};
    let sessionToken = sessionStorage.getItem("immich_auth_session") || "";

    function setSessionToken(token) {
      sessionToken = token || "";
      if (token) {
        sessionStorage.setItem("immich_auth_session", token);
      } else {
        sessionStorage.removeItem("immich_auth_session");
      }
    }

    function authHeaders() {
      const headers = { "Content-Type": "application/json" };
      if (sessionToken) {
        headers.Authorization = "Bearer " + sessionToken;
      }
      return headers;
    }

    function setStatus(msg) {
      const el = document.getElementById("status");
      if (el) el.textContent = msg;
    }

    function liffEntryPath(subpath, query) {
      const path = subpath ? (subpath.startsWith("/") ? subpath : "/" + subpath) : "";
      const qs = query || "";
      return "https://liff.line.me/" + liffId + path + qs;
    }

    function canonicalLiffPath() {
      const path = window.location.pathname;
      if (path === "/liff/settings" || path.startsWith("/liff/settings/")) {
        return "/liff/hub/settings" + path.slice("/liff/settings".length) + window.location.search;
      }
      if (path === "/liff/admin" || path.startsWith("/liff/admin/")) {
        return "/liff/hub/admin" + path.slice("/liff/admin".length) + window.location.search;
      }
      return null;
    }

    function liffSubpathFromLocation() {
      const path = window.location.pathname;
      if (path.startsWith("/liff/hub")) {
        return path.slice("/liff/hub".length) || "";
      }
      return "";
    }

    async function initLiff(options) {
      const opts = options || {};
      const allowExternalBrowser = Boolean(opts.allowExternalBrowser);
      if (!liffId) {
        setStatus("開發模式：未綁定 LIFF_ID。");
        return { ok: false, reason: "no_liff" };
      }
      const canonical = canonicalLiffPath();
      if (canonical) {
        window.location.replace(canonical);
        return { ok: false, reason: "canonical_redirect" };
      }
      await liff.init({ liffId });
      const inClient = liff.isInClient();
      if (!inClient && !allowExternalBrowser) {
        const subpath = liffSubpathFromLocation();
        const qs = window.location.search || "";
        const target = subpath === "" || subpath === "/"
          ? liffEntryPath("/settings", qs)
          : liffEntryPath(subpath, qs);
        setStatus("正在導向 LINE 登入…");
        window.location.replace(target);
        return { ok: false, reason: "liff_redirect" };
      }
      if (!liff.isLoggedIn()) {
        setStatus(inClient ? "正在登入 LINE…" : "正在登入 LINE（Safari）…");
        liff.login({ redirectUri: window.location.href });
        return { ok: false, reason: "login_redirect" };
      }
      const idToken = liff.getIDToken();
      if (!idToken) {
        setStatus("無法取得 idToken。請確認 LIFF 已勾選 openid scope。");
        return { ok: false, reason: "no_id_token" };
      }
      const res = await fetch("/api/v1/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionToken) {
        setStatus("登入失敗：" + (data.error || res.status));
        return { ok: false, reason: "session_failed" };
      }
      setSessionToken(data.sessionToken);
      return { ok: true, role: data.role, authLevel: data.authLevel, inClient };
    }

    function liffPasskeyUrl(action) {
      const qs = action ? "?action=" + encodeURIComponent(action) : "";
      return liffEntryPath("/settings", qs);
    }

    /** LINE 內建 WebView 不支援 WebAuthn；改以 Safari / 系統瀏覽器完成 Passkey。 */
    function openPasskeyInExternalBrowser(action) {
      if (!liff.isInClient()) return false;
      liff.openWindow({ url: liffPasskeyUrl(action), external: true });
      setStatus("已於 Safari 開啟，請在該視窗完成 Face ID / Passkey 操作後返回 LINE。");
      return true;
    }

    function isPasskeyNotAllowedError(err) {
      const msg = String(err && err.message ? err.message : err).toLowerCase();
      return (
        msg.includes("not allowed") ||
        msg.includes("not supported") ||
        msg.includes("securityerror") ||
        msg.includes("invalid state")
      );
    }

    async function fetchAuthMe() {
      const res = await fetch("/api/v1/auth/me", { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || ("HTTP " + res.status));
      }
      return data;
    }

    async function loadWebAuthnBrowser() {
      return import("https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@13.1.2/+esm");
    }

    async function unlockWithPasskey() {
      if (!window.PublicKeyCredential) {
        throw new Error("此裝置不支援 Passkey / Face ID");
      }
      const { startAuthentication } = await loadWebAuthnBrowser();
      const optRes = await fetch("/api/v1/auth/webauthn/assert/options", {
        method: "POST",
        headers: authHeaders(),
      });
      const optBody = await optRes.json().catch(() => ({}));
      if (!optRes.ok || !optBody.options) {
        throw new Error(optBody.error || ("HTTP " + optRes.status));
      }
      const authResp = await startAuthentication({ optionsJSON: optBody.options });
      const upgradeRes = await fetch("/api/v1/auth/webauthn/session/upgrade", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ response: authResp }),
      });
      const upgradeBody = await upgradeRes.json().catch(() => ({}));
      if (!upgradeRes.ok || !upgradeBody.sessionToken) {
        throw new Error(upgradeBody.error || ("HTTP " + upgradeRes.status));
      }
      setSessionToken(upgradeBody.sessionToken);
      return upgradeBody;
    }

    async function registerPasskey() {
      if (!window.PublicKeyCredential) {
        throw new Error("此裝置不支援 Passkey / Face ID");
      }
      const { startRegistration } = await loadWebAuthnBrowser();
      const optRes = await fetch("/api/v1/auth/webauthn/register/options", {
        method: "POST",
        headers: authHeaders(),
      });
      const optBody = await optRes.json().catch(() => ({}));
      if (!optRes.ok || !optBody.options) {
        throw new Error(optBody.error || ("HTTP " + optRes.status));
      }
      const attResp = await startRegistration({ optionsJSON: optBody.options });
      const verifyRes = await fetch("/api/v1/auth/webauthn/register/verify", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ response: attResp }),
      });
      const verifyBody = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        throw new Error(verifyBody.error || ("HTTP " + verifyRes.status));
      }
      return verifyBody;
    }
  `;
}

export function liffHubPageUrl(): string {
  return `${env.lineBotPublicUrl.replace(/\/$/, "")}/liff/hub`;
}

export function liffEntryUrl(): string | null {
  if (!env.liffId) {
    return null;
  }
  return `https://liff.line.me/${env.liffId}`;
}
