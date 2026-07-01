import { env } from "../line-bot/config/env";
import { liffHubStyles, renderLiffClientScript } from "./liff-shared";

export function renderLiffSettingsPage(): string {
  const liffId = env.liffId;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Immich · 帳戶設定</title>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>${liffHubStyles}</style>
</head>
<body>
  <p class="sub"><a href="/liff/hub">← 返回相簿中心</a></p>
  <h1>帳戶與 Passkey</h1>

  <div id="unlock-panel" class="card hidden">
    <h3>🔐 需要解鎖</h3>
    <p>變更 Passkey 前請先驗證 Face ID。</p>
    <button type="button" id="unlock-btn">使用 Face ID 解鎖</button>
  </div>

  <div id="settings-panel" class="hidden">
    <div id="liff-passkey-hint" class="setup hidden">
      Passkey / Face ID 需在 <strong>Safari</strong> 完成。點下方按鈕將開啟外部瀏覽器。
    </div>
    <div class="card">
      <h3>Passkey / Face ID</h3>
      <p id="passkey-summary">載入中…</p>
      <button type="button" id="register-btn">註冊 Passkey</button>
      <button type="button" id="revoke-btn" class="secondary hidden">移除 Passkey</button>
    </div>
  </div>

  <p id="status"></p>
  <script>
    ${renderLiffClientScript(liffId)}

    const unlockPanel = document.getElementById("unlock-panel");
    const settingsPanel = document.getElementById("settings-panel");
    const revokeBtn = document.getElementById("revoke-btn");

    async function loadSettings() {
      const res = await fetch("/api/v1/auth/settings", { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.error === "passkey_gate_required") {
        unlockPanel.classList.remove("hidden");
        settingsPanel.classList.add("hidden");
        return null;
      }
      if (!res.ok) {
        throw new Error(data.error || ("HTTP " + res.status));
      }
      return data;
    }

    function renderSettings(data) {
      unlockPanel.classList.add("hidden");
      settingsPanel.classList.remove("hidden");
      const count = data.passkeys?.length || 0;
      document.getElementById("passkey-summary").textContent =
        count > 0 ? "已註冊 " + count + " 組 Passkey" : "尚未註冊 Passkey";
      revokeBtn.classList.toggle("hidden", count === 0);
      if (count > 0) {
        revokeBtn.dataset.credentialId = data.passkeys[0].id;
      }
    }

    async function runPasskeyAction(action, fn) {
      if (typeof liff !== "undefined" && liff.isInClient && liff.isInClient()) {
        openPasskeyInExternalBrowser(action);
        return;
      }
      await fn();
    }

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const passkeyAction = params.get("action");
      const init = await initLiff({ allowExternalBrowser: true });
      if (!init.ok) return;
      if (init.inClient) {
        document.getElementById("liff-passkey-hint").classList.remove("hidden");
      }
      const data = await loadSettings();
      if (data) {
        renderSettings(data);
      }
      if (passkeyAction === "register") {
        setStatus("註冊 Passkey…");
        try {
          await registerPasskey();
          const refreshed = await loadSettings();
          if (refreshed) renderSettings(refreshed);
          setStatus("Passkey 已註冊，可返回 LINE。");
        } catch (err) {
          setStatus("註冊失敗：" + err.message);
        }
      } else if (passkeyAction === "unlock") {
        setStatus("驗證中…");
        try {
          await unlockWithPasskey();
          const refreshed = await loadSettings();
          if (refreshed) renderSettings(refreshed);
          setStatus("已解鎖");
        } catch (err) {
          setStatus("解鎖失敗：" + err.message);
        }
      }
    }

    document.getElementById("unlock-btn").addEventListener("click", async () => {
      setStatus("驗證中…");
      try {
        await runPasskeyAction("unlock", unlockWithPasskey);
        const data = await loadSettings();
        if (data) renderSettings(data);
      } catch (err) {
        if (isPasskeyNotAllowedError(err) && openPasskeyInExternalBrowser("unlock")) return;
        setStatus("解鎖失敗：" + err.message);
      }
    });

    document.getElementById("register-btn").addEventListener("click", async () => {
      setStatus("註冊 Passkey…");
      try {
        await runPasskeyAction("register", async () => {
          await registerPasskey();
          const data = await loadSettings();
          if (data) renderSettings(data);
          setStatus("Passkey 已註冊");
        });
      } catch (err) {
        if (isPasskeyNotAllowedError(err) && openPasskeyInExternalBrowser("register")) return;
        setStatus("註冊失敗：" + err.message);
      }
    });

    revokeBtn.addEventListener("click", async () => {
      const credentialId = revokeBtn.dataset.credentialId;
      if (!credentialId) return;
      setStatus("移除中…");
      try {
        const res = await fetch("/api/v1/auth/webauthn/credentials/revoke", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ credentialId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
        const settings = await loadSettings();
        if (settings) renderSettings(settings);
        setStatus("已移除 Passkey");
      } catch (err) {
        setStatus("移除失敗：" + err.message);
      }
    });

    bootstrap().catch((err) => setStatus("錯誤：" + err.message));
  </script>
</body>
</html>`;
}
