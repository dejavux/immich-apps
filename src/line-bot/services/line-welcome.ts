/** LINE welcome + Rich Menu copy (Traditional Chinese). */

export const WELCOME_MESSAGE =
  "👋 歡迎使用 Immich 照片助手！\n\n" +
  "我可以幫你：\n" +
  "🔍 用自然語言找照片\n" +
  "📸 把 LINE 媒體備份到 Immich\n\n" +
  "上傳方式：\n" +
  "• 照片：直接傳圖（LINE 會壓縮，適合日常備份）\n" +
  "• 檔案：用「檔案」傳送（保留原檔 JPG/HEIC/PNG/MOV/MP4）\n" +
  "• 影片：轉傳或傳送影片 clip\n\n" +
  "請點下方選單，或直接輸入：\n" +
  "• 找在海邊的照片\n" +
  "• 幫我找小蕊一歲半的照片";

export const SEARCH_HELP_MESSAGE =
  "🔍 找照片範例：\n" +
  "• 找在海邊的照片\n" +
  "• 幫我找小蕊一歲半的照片\n" +
  "• 找 2024-06-01 的相片\n\n" +
  "點下方快捷按鈕試試，或直接輸入你的描述。";

/** Quick Reply chips shown after「找照片」help. */
export const SEARCH_HELP_QUICK_REPLIES = [
  { label: "🌊 海邊", text: "找在海邊的照片" },
  { label: "👧 小蕊一歲半", text: "幫我找小蕊一歲半的照片" },
  { label: "📅 指定日期", text: "找 2024-06-01 的相片" },
] as const;

export function buildUploadHelpText(): string {
  return (
    "📸 上傳方式：\n" +
    "• 照片（壓縮）：直接傳圖，LINE 會壓縮畫質，適合快速備份\n" +
    "• 檔案（原檔）：點「＋」→ 檔案，傳 JPG/HEIC/PNG/MOV/MP4 保留原始畫質\n" +
    "• 影片 clip：轉傳聊天室影片，或直接傳送短影片\n\n" +
    "🔍 搜尋方式：\n" +
    "• 幫我找小蕊一歲半的照片\n" +
    "• 找在海邊的照片\n" +
    "• 找 2024-06-01 的相片"
  );
}

export const RICH_MENU_LABELS = {
  search: "找照片",
  upload: "上傳教學",
  help: "使用說明",
  settings: "帳戶設定",
} as const;

/** Rich Menu message actions (sent as user text). */
export const RICH_MENU_MESSAGES = {
  search: "找照片",
  upload: "怎麼上傳照片",
  help: "使用說明",
} as const;
