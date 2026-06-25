/** LINE welcome + Rich Menu copy (Traditional Chinese). */

export const WELCOME_MESSAGE =
  "👋 歡迎使用 Immich 照片助手！\n\n" +
  "我可以幫你：\n" +
  "🔍 用自然語言找照片\n" +
  "📸 把 LINE 照片備份到 Immich\n\n" +
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
    "• 一般照片：直接傳圖\n" +
    "• 保留原檔：用「檔案」傳送 JPG/HEIC/PNG\n\n" +
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
} as const;

/** Rich Menu message actions (sent as user text). */
export const RICH_MENU_MESSAGES = {
  search: "找照片",
  upload: "怎麼上傳照片",
  help: "使用說明",
} as const;
