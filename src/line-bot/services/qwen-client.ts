import axios from "axios";

import { logger } from "../../shared/logger";

export interface QwenChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QwenClientOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

export class QwenClient {
  constructor(private readonly options: QwenClientOptions) {}

  async chatJson<T>(messages: QwenChatMessage[]): Promise<T> {
    const url = `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.options.apiKey) {
      headers.Authorization = `Bearer ${this.options.apiKey}`;
    }

    const response = await axios.post<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(
      url,
      {
        model: this.options.model,
        messages,
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      {
        headers,
        timeout: this.options.timeoutMs,
      },
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Qwen returned empty completion");
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      logger.warn({ content, error }, "Failed to parse Qwen JSON response");
      throw new Error("Qwen response is not valid JSON");
    }
  }
}
