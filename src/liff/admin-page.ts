import { env } from "../line-bot/config/env";
import { liffHubStyles, renderLiffClientScript } from "./liff-shared";

export function renderLiffAdminPage(): string {
  const liffId = env.liffId;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Immich · 管理員</title>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>${liffHubStyles}</style>
</head>
<body>
  <p class="sub"><a href="/liff/hub">← 返回相簿中心</a></p>
  <h1>管理員設定</h1>

  <div id="unlock-panel" class="card hidden">
    <h3>🔐 需要解鎖</h3>
    <button type="button" id="unlock-btn">使用 Face ID 解鎖</button>
  </div>

  <div id="admin-panel" class="hidden">
    <div class="card">
      <h3>Immich 連線</h3>
      <pre id="admin-json" style="font-size:0.75rem;overflow:auto;color:var(--muted);"></pre>
    </div>
  </div>

  <p id="status"></p>
  <script>
    ${renderLiffClientScript(liffId)}

    const unlockPanel = document.getElementById("unlock-panel");
    const adminPanel = document.getElementById("admin-panel");

    async function loadAdmin() {
      const res = await fetch("/api/v1/auth/admin/settings", { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.error === "passkey_gate_required") {
        unlockPanel.classList.remove("hidden");
        adminPanel.classList.add("hidden");
        return null;
      }
      if (!res.ok) {
        throw new Error(data.error || ("HTTP " + res.status));
      }
      return data;
    }

    async function bootstrap() {
      const init = await initLiff();
      if (!init.ok) return;
      const data = await loadAdmin();
      if (!data) return;
      unlockPanel.classList.add("hidden");
      adminPanel.classList.remove("hidden");
      document.getElementById("admin-json").textContent =
        JSON.stringify(data.admin, null, 2);
    }

    document.getElementById("unlock-btn").addEventListener("click", async () => {
      setStatus("驗證中…");
      try {
        await unlockWithPasskey();
        await bootstrap();
      } catch (err) {
        setStatus("解鎖失敗：" + err.message);
      }
    });

    bootstrap().catch((err) => setStatus("錯誤：" + err.message));
  </script>
</body>
</html>`;
}
