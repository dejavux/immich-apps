import type { AgencyId } from "./tour-summary.js";
import type { DateWindow } from "./date-window.js";
import type { DestinationIntent } from "./destination-intent.js";
import type { DurationRange } from "./duration-range.js";
import type { BudgetRange, DepartFrom, TourType } from "./wizard-session.js";

export type SearchParams = {
  keywords: string;
  dateWindow: DateWindow;
  duration?: DurationRange;
  destination?: DestinationIntent;
  departFrom?: DepartFrom;
  tourType: TourType;
  mustTags?: string[];
  budget?: BudgetRange;
  page?: number;
  pageSize?: number;
};

export type { AgencyId };
