import { env } from "../line-bot/config/env";
import { liffHubStyles, liffHubPageUrl, renderLiffClientScript } from "./liff-shared";

export function renderLiffHubPage(): string {
  const liffId = env.liffId;
  const endpoint = liffHubPageUrl();
  const immichWebUrl = env.immichWebUrl;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Immich · 相簿中心</title>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>${liffHubStyles}</style>
</head>
<body>
  <h1>Immich 相簿</h1>
  <p class="sub">透過 LINE 快速開啟家庭相簿與帳戶設定</p>
  ${
    liffId
      ? ""
      : `<div class="setup">尚未設定 <code>LIFF_ID</code>。Endpoint 建議設為 <code>${endpoint}</code></div>`
  }

  <div id="unlock-panel" class="card hidden">
    <h3>🔐 解鎖設定</h3>
    <p>已啟用 Face ID / Passkey 保護。請驗證後管理帳戶。</p>
    <button type="button" id="unlock-btn">使用 Face ID 解鎖</button>
  </div>

  <div id="hub-panel" class="hidden">
    <p class="sub" id="welcome-line">載入中…</p>
    <div class="card">
      <h3>開啟 Immich</h3>
      <p>在瀏覽器檢視完整相簿、上傳與分享。</p>
      <a class="btn" href="${immichWebUrl}" target="_blank" rel="noopener">前往 ${immichWebUrl.replace(/^https?:\/\//, "")}</a>
    </div>
    <div class="card">
      <h3>LINE Bot</h3>
      <p>在聊天室傳照片或輸入搜尋關鍵字（例：去年聖誕）。</p>
    </div>
    <a class="btn secondary" href="/liff/hub/settings">帳戶與 Passkey</a>
    <a class="btn secondary hidden" id="admin-link" href="/liff/hub/admin">管理員設定</a>
  </div>

  <p id="status">初始化中…</p>
  <script>
    ${renderLiffClientScript(liffId)}

    const unlockPanel = document.getElementById("unlock-panel");
    const hubPanel = document.getElementById("hub-panel");
    const adminLink = document.getElementById("admin-link");

    function showHub(me) {
      unlockPanel.classList.add("hidden");
      hubPanel.classList.remove("hidden");
      document.getElementById("welcome-line").textContent =
        "已登入 · 角色：" + (me.role === "admin" ? "管理員" : "一般使用者");
      if (me.role === "admin") {
        adminLink.classList.remove("hidden");
      }
      setStatus("");
    }

    async function bootstrap() {
      installAuthSyncOnVisibility(async () => {
        try {
          await refreshAuthSession();
          const me = await fetchAuthMe();
          if (!me.requiresUnlock) {
            showHub(me);
          }
        } catch (_) {}
      });
      const init = await initLiff();
      if (!init.ok) return;
      await refreshAuthSession();
      let me;
      try {
        me = await fetchAuthMe();
      } catch (err) {
        setStatus("載入失敗：" + err.message);
        return;
      }
      if (me.requiresUnlock) {
        unlockPanel.classList.remove("hidden");
        setStatus("請使用 Face ID / Passkey 解鎖");
        return;
      }
      showHub(me);
    }

    document.getElementById("unlock-btn").addEventListener("click", async () => {
      setStatus("驗證中…");
      try {
        if (typeof liff !== "undefined" && liff.isInClient && liff.isInClient()) {
          openPasskeyInExternalBrowser("unlock");
          return;
        }
        await unlockWithPasskey();
        const me = await fetchAuthMe();
        showHub(me);
      } catch (err) {
        if (isPasskeyNotAllowedError(err) && openPasskeyInExternalBrowser("unlock")) return;
        setStatus("解鎖失敗：" + err.message);
      }
    });

    bootstrap().catch((err) => setStatus("錯誤：" + err.message));
  </script>
</body>
</html>`;
}
