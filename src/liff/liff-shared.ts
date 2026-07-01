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

    async function initLiff() {
      if (!liffId) {
        setStatus("開發模式：未綁定 LIFF_ID。");
        return { ok: false, reason: "no_liff" };
      }
      await liff.init({ liffId });
      if (!liff.isInClient()) {
        setStatus("請在 LINE 內開啟此頁面。");
        return { ok: false, reason: "not_in_client" };
      }
      if (!liff.isLoggedIn()) {
        setStatus("正在登入 LINE…");
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
      return { ok: true, role: data.role, authLevel: data.authLevel };
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
