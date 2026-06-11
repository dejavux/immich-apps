import {
  ageToTakenRange,
  explicitDateRange,
  parseIsoDateOnly,
} from "../../shared/date-range";
import { ImmichClient } from "../../shared/immich-client";
import { logger } from "../../shared/logger";
import type { ImmichPersonSummary } from "../../shared/types/immich";
import type {
  PhotoSearchAssetHit,
  PhotoSearchPlan,
  PhotoSearchResult,
} from "../../shared/types/photo-search";
import {
  buildSearchUserPrompt,
  buildPhotoSearchSystemPrompt,
  ensureActivityFromText,
  ensureAgeFromText,
  ensureRelativeDatesFromText,
  ensureSceneQueryEn,
  parseLlmSearchResponse,
  parseSearchPlanFallback,
  summarizeSessionForPrompt,
  type RawLlmSearchResponse,
} from "./photo-search-prompt";
import { QwenClient } from "./qwen-client";
import { SearchSessionStore } from "./search-session-store";
import { resolvePersonSearchName } from "./person-aliases";

export interface PhotoSearchServiceOptions {
  immichClient: ImmichClient;
  immichWebUrl: string;
  sessionStore: SearchSessionStore;
  qwenClient?: QwenClient;
  maxResults: number;
  ageWindowDays: number;
  personAliases: Map<string, string>;
}

export class PhotoSearchService {
  constructor(private readonly options: PhotoSearchServiceOptions) {}

  async handleMessage(
    userId: string,
    message: string,
  ): Promise<PhotoSearchResult> {
    const session = this.options.sessionStore.get(userId);
    const plan = await this.resolvePlan(message, session);

    if (plan.intent === "cancel") {
      this.options.sessionStore.clear(userId);
      return { kind: "help", message: "已取消搜尋。" };
    }

    if (plan.intent === "upload_help") {
      return { kind: "help", message: buildUploadHelpText() };
    }

    if (plan.intent !== "search_photos") {
      return {
        kind: "help",
        message:
          "我可以幫你找照片 🔍\n\n" +
          "範例：\n" +
          "• 幫我找小蕊一歲半的照片\n" +
          "• 找在海邊的照片\n" +
          "• 找 2024-06-01 的相片\n\n" +
          buildUploadHelpText(),
      };
    }

    const merged = mergePlans(session?.plan, plan);
    return this.executeSearch(userId, merged, session?.personCandidates);
  }

  private async resolvePlan(
    message: string,
    session: ReturnType<SearchSessionStore["get"]>,
  ): Promise<PhotoSearchPlan> {
    if (this.options.qwenClient) {
      try {
        const sessionSummary = session
          ? summarizeSessionForPrompt(session)
          : undefined;
        const raw =
          await this.options.qwenClient.chatJson<RawLlmSearchResponse>([
            { role: "system", content: buildPhotoSearchSystemPrompt() },
            {
              role: "user",
              content: buildSearchUserPrompt({ message, sessionSummary }),
            },
          ]);
        return this.normalizeSearchPlan(parseLlmSearchResponse(raw), message);
      } catch (error) {
        logger.warn(
          { error },
          "Qwen search plan failed, using fallback parser",
        );
      }
    }
    return this.normalizeSearchPlan(parseSearchPlanFallback(message), message);
  }

  private normalizeSearchPlan(
    plan: PhotoSearchPlan,
    message: string,
  ): PhotoSearchPlan {
    return ensureSceneQueryEn(
      ensureActivityFromText(
        ensureAgeFromText(ensureRelativeDatesFromText(plan, message), message),
        message,
      ),
    );
  }

  private hasSceneQuery(plan: Partial<PhotoSearchPlan>): boolean {
    return Boolean(plan.sceneQuery?.trim() || plan.sceneQueryEn?.trim());
  }

  private sceneClipQuery(plan: Partial<PhotoSearchPlan>): string {
    const english = plan.sceneQueryEn?.trim();
    if (english) {
      return english;
    }
    const chinese = plan.sceneQuery?.trim();
    return chinese ?? "";
  }

  private sceneLabel(plan: Partial<PhotoSearchPlan>): string {
    return plan.sceneQuery?.trim() || plan.sceneQueryEn?.trim() || "場景";
  }

  private async searchAssets(
    plan: Partial<PhotoSearchPlan>,
    filters: {
      personIds?: string[];
      takenAfter?: string;
      takenBefore?: string;
    },
  ): Promise<{ items: PhotoSearchAssetHit[]; total: number }> {
    if (this.hasSceneQuery(plan)) {
      return this.options.immichClient.searchSmart({
        query: this.sceneClipQuery(plan),
        personIds: filters.personIds,
        takenAfter: filters.takenAfter,
        takenBefore: filters.takenBefore,
        size: this.options.maxResults,
      });
    }
    return this.options.immichClient.searchMetadata({
      personIds: filters.personIds,
      takenAfter: filters.takenAfter,
      takenBefore: filters.takenBefore,
      size: this.options.maxResults,
    });
  }

  private async finishAssetSearch(
    userId: string,
    personName: string | undefined,
    criteriaLabel: string,
    plan: Partial<PhotoSearchPlan>,
    filters: {
      personIds?: string[];
      takenAfter?: string;
      takenBefore?: string;
    },
  ): Promise<PhotoSearchResult> {
    const { items, total } = await this.searchAssets(plan, filters);
    this.options.sessionStore.clear(userId);

    if (items.length === 0) {
      return {
        kind: "empty",
        message:
          `找不到符合條件的照片（${criteriaLabel}）。\n` +
          (this.hasSceneQuery(plan)
            ? "試試換個場景描述，或確認 Immich smart search 已索引。"
            : "試試放寬年齡或確認 Immich 人臉已命名。"),
        total: 0,
      };
    }

    return {
      kind: "results",
      message: formatResultsHeader(personName, criteriaLabel, total),
      assets: items,
      total,
    };
  }

  private async executeSearch(
    userId: string,
    plan: Partial<PhotoSearchPlan>,
    existingCandidates?: ImmichPersonSummary[],
  ): Promise<PhotoSearchResult> {
    if (plan.personChoice && existingCandidates?.length) {
      const picked = existingCandidates[plan.personChoice - 1];
      if (!picked) {
        return {
          kind: "clarify",
          message: `請回覆 1 到 ${existingCandidates.length} 之間的編號。`,
        };
      }
      return this.searchWithPerson(userId, plan, picked);
    }

    const personName = plan.personNames?.[0];
    const sceneOnly =
      this.hasSceneQuery(plan) &&
      !personName &&
      !plan.dateFrom &&
      plan.ageYears === undefined &&
      plan.ageMonths === undefined;

    if (sceneOnly) {
      return this.searchBySceneOnly(userId, plan);
    }

    if (!personName && !plan.dateFrom && !this.hasSceneQuery(plan)) {
      return {
        kind: "clarify",
        message: "請告訴我想找誰的照片，或指定日期（例如 2024-06-01）。",
      };
    }

    if (personName) {
      const immichName = resolvePersonSearchName(
        personName,
        this.options.personAliases,
      );
      const people =
        await this.options.immichClient.searchPersonByName(immichName);
      if (people.length === 0) {
        this.options.sessionStore.save(userId, { plan });
        const aliasHint =
          immichName !== personName
            ? `\n（已對照 Immich 名稱「${immichName}」仍找不到）`
            : "";
        return {
          kind: "clarify",
          message:
            `Immich 找不到「${personName}」。${aliasHint}\n` +
            "請確認 Immich 人物命名，或改用日期搜尋。",
        };
      }
      if (people.length > 1) {
        this.options.sessionStore.save(userId, {
          plan,
          personCandidates: people,
        });
        const list = people
          .map(
            (p, i) =>
              `${i + 1}. ${p.name}${p.birthDate ? `（生日 ${p.birthDate}）` : ""}`,
          )
          .join("\n");
        return {
          kind: "clarify",
          message: `找到多位「${personName}」：\n${list}\n\n請回覆編號（例如 1）。`,
        };
      }
      return this.searchWithPerson(userId, plan, people[0]);
    }

    return this.searchByDateOnly(userId, plan);
  }

  private async searchBySceneOnly(
    userId: string,
    plan: Partial<PhotoSearchPlan>,
  ): Promise<PhotoSearchResult> {
    const query = this.sceneClipQuery(plan);
    if (!query) {
      return {
        kind: "clarify",
        message: "請描述想找什麼場景（例如：在海邊、生日蛋糕）。",
      };
    }

    const scene = this.sceneLabel(plan);
    const { label: dateLabel, ...dateRange } = this.planDateFilters(plan);
    const labelText = dateLabel ? `${dateLabel} · ${scene}` : scene;
    return this.finishAssetSearch(
      userId,
      undefined,
      labelText,
      plan,
      dateRange,
    );
  }

  private planDateFilters(plan: Partial<PhotoSearchPlan>): {
    takenAfter?: string;
    takenBefore?: string;
    label?: string;
  } {
    if (!plan.dateFrom) {
      return {};
    }
    const range = explicitDateRange(plan.dateFrom, plan.dateTo);
    if (!range) {
      return {};
    }
    const label =
      plan.dateRangeLabel ??
      (plan.dateTo && plan.dateTo !== plan.dateFrom
        ? `${plan.dateFrom}～${plan.dateTo}`
        : plan.dateFrom);
    return {
      takenAfter: range.takenAfter,
      takenBefore: range.takenBefore,
      label,
    };
  }

  private personDisplayName(
    plan: Partial<PhotoSearchPlan>,
    person: ImmichPersonSummary,
  ): string {
    return plan.personNames?.[0]?.trim() || person.name;
  }

  private async searchWithPerson(
    userId: string,
    plan: Partial<PhotoSearchPlan>,
    person: ImmichPersonSummary,
  ): Promise<PhotoSearchResult> {
    const displayName = this.personDisplayName(plan, person);
    const hasScene = this.hasSceneQuery(plan);
    const hasAge = plan.ageYears !== undefined || plan.ageMonths !== undefined;
    const range = resolveTakenRange(plan, person, this.options.ageWindowDays);

    if (!range.ok) {
      if (hasAge || !hasScene) {
        this.options.sessionStore.save(userId, {
          plan: {
            ...plan,
            personNames: plan.personNames?.length
              ? plan.personNames
              : [person.name],
          },
        });
        return { kind: "clarify", message: range.question };
      }

      const dateFilters = this.planDateFilters(plan);
      const { label: dateLabel, ...dateRange } = dateFilters;
      const labelParts = [displayName, dateLabel, this.sceneLabel(plan)].filter(
        Boolean,
      );
      return this.finishAssetSearch(
        userId,
        displayName,
        labelParts.join(" · "),
        plan,
        {
          personIds: [person.id],
          ...dateRange,
        },
      );
    }

    const criteriaLabel = hasScene
      ? `${range.label} · ${this.sceneLabel(plan)}`
      : range.label;

    return this.finishAssetSearch(userId, displayName, criteriaLabel, plan, {
      personIds: [person.id],
      takenAfter: range.takenAfter,
      takenBefore: range.takenBefore,
    });
  }

  private async searchByDateOnly(
    userId: string,
    plan: Partial<PhotoSearchPlan>,
  ): Promise<PhotoSearchResult> {
    if (!plan.dateFrom) {
      return { kind: "clarify", message: "請提供日期（YYYY-MM-DD）。" };
    }
    const range = explicitDateRange(plan.dateFrom, plan.dateTo);
    if (!range) {
      return { kind: "clarify", message: "日期格式請用 YYYY-MM-DD。" };
    }

    const label = this.hasSceneQuery(plan)
      ? `${plan.dateFrom} · ${this.sceneLabel(plan)}`
      : plan.dateFrom;

    return this.finishAssetSearch(userId, undefined, label, plan, {
      takenAfter: range.takenAfter,
      takenBefore: range.takenBefore,
    });
  }
}

export function mergePlans(
  base: Partial<PhotoSearchPlan> | undefined,
  incoming: PhotoSearchPlan,
): Partial<PhotoSearchPlan> {
  const merged: Partial<PhotoSearchPlan> = { ...base, ...incoming };
  if (!incoming.personNames?.length && base?.personNames?.length) {
    merged.personNames = base.personNames;
  }
  if (incoming.ageYears === undefined && base?.ageYears !== undefined) {
    merged.ageYears = base.ageYears;
  }
  if (incoming.ageMonths === undefined && base?.ageMonths !== undefined) {
    merged.ageMonths = base.ageMonths;
  }
  if (!incoming.birthDate && base?.birthDate) {
    merged.birthDate = base.birthDate;
  }
  if (!incoming.dateFrom && base?.dateFrom) {
    merged.dateFrom = base.dateFrom;
  }
  if (!incoming.dateTo && base?.dateTo) {
    merged.dateTo = base.dateTo;
  }
  if (!incoming.dateRangeLabel && base?.dateRangeLabel) {
    merged.dateRangeLabel = base.dateRangeLabel;
  }
  if (!incoming.sceneQuery && base?.sceneQuery) {
    merged.sceneQuery = base.sceneQuery;
  }
  if (!incoming.sceneQueryEn && base?.sceneQueryEn) {
    merged.sceneQueryEn = base.sceneQueryEn;
  }
  return merged;
}

type RangeResult =
  | { ok: true; takenAfter: string; takenBefore: string; label: string }
  | { ok: false; question: string };

export function resolveTakenRange(
  plan: Partial<PhotoSearchPlan>,
  person: ImmichPersonSummary,
  ageWindowDays = 45,
): RangeResult {
  if (plan.dateFrom) {
    const range = explicitDateRange(plan.dateFrom, plan.dateTo);
    if (!range) {
      return { ok: false, question: "日期格式請用 YYYY-MM-DD。" };
    }
    return {
      ok: true,
      takenAfter: range.takenAfter,
      takenBefore: range.takenBefore,
      label:
        plan.dateRangeLabel ??
        (plan.dateTo && plan.dateTo !== plan.dateFrom
          ? `${plan.dateFrom}～${plan.dateTo}`
          : (plan.dateFrom ?? "")),
    };
  }

  const hasAge = plan.ageYears !== undefined || plan.ageMonths !== undefined;
  if (!hasAge) {
    return {
      ok: false,
      question: `請提供「${person.name}」的年齡（例如 1.5 歲）或拍攝日期。`,
    };
  }

  const birthIso = plan.birthDate ?? person.birthDate ?? undefined;
  if (!birthIso) {
    return {
      ok: false,
      question:
        `Immich 沒有「${person.name}」的生日。\n` +
        "請回覆生日（YYYY-MM-DD），例如 2019-03-15。",
    };
  }

  const birth = parseIsoDateOnly(birthIso.slice(0, 10));
  if (!birth) {
    return { ok: false, question: "生日格式請用 YYYY-MM-DD。" };
  }

  const range = ageToTakenRange({
    birthDate: birth,
    ageYears: plan.ageYears,
    ageMonths: plan.ageMonths,
    windowDays: ageWindowDays,
  });

  const ageLabel =
    plan.ageMonths !== undefined
      ? `${plan.ageMonths} 個月`
      : `${plan.ageYears} 歲`;

  return {
    ok: true,
    takenAfter: range.takenAfter,
    takenBefore: range.takenBefore,
    label: `${ageLabel} 左右（生日 ${birthIso.slice(0, 10)}）`,
  };
}

export function formatResultsHeader(
  personName: string | undefined,
  criteriaLabel: string,
  total: number,
): string {
  return personName
    ? `🔍 找到 ${total} 張「${personName}」的照片（${criteriaLabel}）`
    : `🔍 找到 ${total} 張照片（${criteriaLabel}）`;
}

/** Text-only fallback when carousel is unavailable. */
export function formatResultsMessage(
  personName: string | undefined,
  criteriaLabel: string,
  items: Array<{
    id: string;
    originalFileName?: string;
    localDateTime?: string;
  }>,
  total: number,
  webBaseUrl: string,
): string {
  const header = formatResultsHeader(personName, criteriaLabel, total);

  const lines = items.map((item, index) => {
    const date = item.localDateTime
      ? item.localDateTime.slice(0, 10)
      : "未知日期";
    const name = item.originalFileName ?? item.id;
    return `${index + 1}. ${date} ${name}\n${webBaseUrl.replace(/\/$/, "")}/photos/${item.id}`;
  });

  const more =
    total > items.length
      ? `\n… 另有 ${total - items.length} 張，請至 Immich 查看`
      : "";

  return `${header}\n\n${lines.join("\n\n")}${more}`;
}

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
