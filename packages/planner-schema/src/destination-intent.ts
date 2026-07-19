/** Wizard `destination` 步驟語意（不鎖定單一地點） */
export type DestinationIntent =
  | { mode: "specific"; keywords: string[] }
  | { mode: "open" }
  | { mode: "suggest"; hint?: string };
