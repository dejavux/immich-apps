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
  sanitizeSearchPlan,
  summarizeSessionForPrompt,
  type RawLlmSearchResponse,
} from "./photo-search-prompt";
import { QwenClient } from "./qwen-client";
import { SearchSessionStore } from "./search-session-store";
import { resolvePersonSearchName } from "./person-aliases";
import { buildUploadHelpText, SEARCH_HELP_MESSAGE } from "./line-welcome";

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
    const trimmed = message.trim();
    if (trimmed === "找照片") {
      return { kind: "help", message: SEARCH_HELP_MESSAGE };
    }
    if (trimmed === "使用說明") {
      return {
        kind: "help",
        message: `${buildUploadHelpText()}\n\n${SEARCH_HELP_MESSAGE}`,
      };
    }

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
    return sanitizeSearchPlan(
      ensureSceneQueryEn(
        ensureActivityFromText(
          ensureAgeFromText(
            ensureRelativeDatesFromText(plan, message),
            message,
          ),
          message,
        ),
      ),
      message,
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
    const country = plan.country ?? undefined;
    const city = plan.city ?? undefined;

    if (this.hasSceneQuery(plan)) {
      return this.options.immichClient.searchSmart({
        query: this.sceneClipQuery(plan),
        personIds: filters.personIds,
        takenAfter: filters.takenAfter,
        takenBefore: filters.takenBefore,
        country,
        city,
        size: this.options.maxResults,
      });
    }
    return this.options.immichClient.searchMetadata({
      personIds: filters.personIds,
      takenAfter: filters.takenAfter,
      takenBefore: filters.takenBefore,
      country,
      city,
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

    const viewAllUrl =
      total > items.length
        ? buildViewAllUrl(
            this.options.immichWebUrl,
            plan,
            filters.personIds?.[0],
          )
        : undefined;

    return {
      kind: "results",
      message: formatResultsHeader(personName, criteriaLabel, total),
      assets: items,
      total,
      viewAllUrl,
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

    const personNames = plan.personNames?.filter((n) => n.trim()) ?? [];
    const personName = personNames[0];
    const hasLocation = Boolean(plan.country || plan.city);
    const noDateConstraint =
      !plan.dateFrom &&
      plan.ageYears === undefined &&
      plan.ageMonths === undefined;
    const locationOrSceneOnly =
      (this.hasSceneQuery(plan) || hasLocation) &&
      personNames.length === 0 &&
      noDateConstraint;

    if (locationOrSceneOnly) {
      return this.searchBySceneOnly(userId, plan);
    }

    if (
      personNames.length === 0 &&
      !plan.dateFrom &&
      !this.hasSceneQuery(plan) &&
      !hasLocation
    ) {
      return {
        kind: "clarify",
        message: "請告訴我想找誰的照片，或指定日期（例如 2024-06-01）。",
      };
    }

    if (personNames.length > 1) {
      return this.searchWithMultiplePersons(userId, plan, personNames);
    }

    if (personName) {
      const outcome = await this.resolvePersonByName(userId, plan, personName);
      if (!outcome.ok) {
        return outcome.result;
      }
      return this.searchWithPerson(userId, plan, outcome.person);
    }

    return this.searchByDateOnly(userId, plan);
  }

  private async searchBySceneOnly(
    userId: string,
    plan: Partial<PhotoSearchPlan>,
  ): Promise<PhotoSearchResult> {
    const query = this.sceneClipQuery(plan);
    const hasLocation = Boolean(plan.country || plan.city);

    if (!query && !hasLocation) {
      return {
        kind: "clarify",
        message: "請描述想找什麼場景（例如：在海邊、生日蛋糕）。",
      };
    }

    const locationLabel = [plan.country, plan.city].filter(Boolean).join(" · ");
    const scene = query ? this.sceneLabel(plan) : undefined;
    const { label: dateLabel, ...dateRange } = this.planDateFilters(plan);
    const labelParts = [locationLabel, scene, dateLabel].filter(Boolean);
    const labelText = labelParts.join(" · ") || "地點";
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
    const names = plan.personNames?.filter((n) => n.trim()) ?? [];
    if (names.length > 1) {
      return names.join("、");
    }
    return names[0]?.trim() || person.name;
  }

  private async resolvePersonByName(
    userId: string,
    plan: Partial<PhotoSearchPlan>,
    personName: string,
  ): Promise<
    | { ok: true; person: ImmichPersonSummary }
    | { ok: false; result: PhotoSearchResult }
  > {
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
        ok: false,
        result: {
          kind: "clarify",
          message:
            `Immich 找不到「${personName}」。${aliasHint}\n` +
            "請確認 Immich 人物命名，或改用日期搜尋。",
        },
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
        ok: false,
        result: {
          kind: "clarify",
          message: `找到多位「${personName}」：\n${list}\n\n請點選下方按鈕或回覆編號。`,
          personCandidates: people,
        },
      };
    }
    return { ok: true, person: people[0] };
  }

  private async searchWithMultiplePersons(
    userId: string,
    plan: Partial<PhotoSearchPlan>,
    personNames: string[],
  ): Promise<PhotoSearchResult> {
    const resolved: ImmichPersonSummary[] = [];
    for (const name of personNames) {
      const outcome = await this.resolvePersonByName(userId, plan, name);
      if (!outcome.ok) {
        return outcome.result;
      }
      resolved.push(outcome.person);
    }

    const displayName = personNames.join("、");
    const hasLocation = Boolean(plan.country || plan.city);
    const locationLabel = [plan.country, plan.city].filter(Boolean).join(" · ");
    const labelParts = [
      displayName,
      locationLabel,
      this.hasSceneQuery(plan) ? this.sceneLabel(plan) : undefined,
    ].filter(Boolean);

    if (hasLocation || plan.anyDate || this.hasSceneQuery(plan)) {
      const { label: dateLabel, ...dateRange } = this.planDateFilters(plan);
      if (dateLabel) {
        labelParts.splice(1, 0, dateLabel);
      }
      return this.finishAssetSearch(
        userId,
        displayName,
        labelParts.filter(Boolean).join(" · "),
        plan,
        {
          personIds: resolved.map((p) => p.id),
          ...dateRange,
        },
      );
    }

    return {
      kind: "clarify",
      message: `請提供「${displayName}」的年齡（例如 7 歲）、拍攝日期，或加上地點（例如在日本）。`,
    };
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
      // When location or "anyDate" is set, skip the age requirement entirely.
      if (plan.country || plan.city || plan.anyDate) {
        const { label: dateLabel, ...dateRange } = this.planDateFilters(plan);
        const locationLabel = [plan.country, plan.city]
          .filter(Boolean)
          .join(" · ");
        const labelParts = [
          displayName,
          locationLabel,
          dateLabel,
          this.hasSceneQuery(plan) ? this.sceneLabel(plan) : undefined,
        ].filter(Boolean);
        return this.finishAssetSearch(
          userId,
          displayName,
          labelParts.join(" · "),
          plan,
          { personIds: [person.id], ...dateRange },
        );
      }

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
  if (incoming.anyDate) {
    merged.anyDate = true;
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

export function buildViewAllUrl(
  immichWebUrl: string,
  plan: Partial<PhotoSearchPlan>,
  personId?: string,
): string | undefined {
  const base = immichWebUrl.replace(/\/$/, "");
  if (personId) {
    return `${base}/people/${personId}`;
  }
  const query = plan.sceneQueryEn?.trim() || plan.sceneQuery?.trim();
  if (query) {
    return `${base}/search?query=${encodeURIComponent(query)}`;
  }
  // Country-only search: link to Immich explore/search (no country param in web URL)
  if (plan.country || plan.city) {
    return `${base}/explore`;
  }
  return undefined;
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
