import { sql } from "drizzle-orm";
import type { motherMeterEvents, transactions } from "../db/schema";

export type RollupGranularity = "day" | "month" | "week";

export interface RollupBucketMeta {
  endDate: string;
  key: string;
  label: string;
  startDate: string;
}

export function getRollupBucketExpression(
  column: typeof transactions.completedAt | typeof motherMeterEvents.createdAt,
  granularity: RollupGranularity,
) {
  if (granularity === "month") {
    return sql<string>`to_char(date_trunc('month', ${column} AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM')`;
  }
  if (granularity === "week") {
    return sql<string>`to_char(date_trunc('week', ${column} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
  }

  return sql<string>`to_char(date_trunc('day', ${column} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
}

export function buildRollupBucketMeta(
  key: string,
  granularity: RollupGranularity,
): RollupBucketMeta {
  if (granularity === "month") {
    const [year, month] = key.split("-").map((part) => Number.parseInt(part, 10));
    const startDate = formatDateUtc(new Date(Date.UTC(year, month - 1, 1)));
    const endDate = formatDateUtc(new Date(Date.UTC(year, month, 0)));
    return {
      endDate,
      key,
      label: key,
      startDate,
    };
  }

  const start = parseDateKey(key);
  const end =
    granularity === "week"
      ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6))
      : start;
  return {
    endDate: formatDateUtc(end),
    key,
    label: granularity === "week" ? `${key} to ${formatDateUtc(end)}` : key,
    startDate: key,
  };
}

function formatDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}
