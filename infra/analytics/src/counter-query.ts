/**
 * Read aggregate counters one London day at a time.
 * The table key is statDay / statKey. Each day is a Query, followed by its
 * own continuation token. Expired rows are returned to the report function,
 * which decides whether they still count.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { AggregateCounterRow } from "@/lib/analytics/aggregate-report";
import type { BrowserCategory, DeviceCategory, TrafficSource } from "@/lib/analytics/event-core";

export const MAX_PAGES_PER_DAY = 50;

export type CounterPage = {
  items: readonly Record<string, unknown>[];
  lastKey?: Record<string, unknown>;
};

export type CounterQuery = {
  queryDay(statDay: string, exclusiveStartKey?: Record<string, unknown>): Promise<CounterPage>;
};

export class CounterQueryError extends Error {
  constructor() {
    super("counter_query_failed");
    this.name = "CounterQueryError";
  }
}

export async function readCounterRows(
  dates: readonly string[],
  dynamo: CounterQuery,
): Promise<AggregateCounterRow[]> {
  const rows: AggregateCounterRow[] = [];
  for (const statDay of dates) {
    let startKey: Record<string, unknown> | undefined;
    let pages = 0;
    do {
      pages += 1;
      if (pages > MAX_PAGES_PER_DAY) throw new CounterQueryError();
      const page = await dynamo.queryDay(statDay, startKey);
      for (const item of page.items) {
        const row = counterRowFromItem(item);
        if (row && row.statDay === statDay) rows.push(row);
      }
      startKey = page.lastKey;
    } while (startKey);
  }
  return rows;
}

/**
 * Copies the counter attributes the report can use.
 * Any other attribute on the item is left behind.
 */
export function counterRowFromItem(item: Record<string, unknown>): AggregateCounterRow | null {
  const metric = item.metric === "page_view" || item.metric === "visit" ? item.metric : null;
  if (!metric || typeof item.statDay !== "string") return null;
  if (typeof item.country !== "string" || typeof item.pagePath !== "string") return null;
  if (
    typeof item.source !== "string" ||
    typeof item.deviceCategory !== "string" ||
    typeof item.browserCategory !== "string"
  ) {
    return null;
  }
  if (typeof item.count !== "number" || typeof item.expiresAt !== "number") return null;
  return {
    statDay: item.statDay,
    metric,
    country: item.country,
    pagePath: item.pagePath,
    source: item.source as TrafficSource,
    deviceCategory: item.deviceCategory as DeviceCategory,
    browserCategory: item.browserCategory as BrowserCategory,
    count: item.count,
    expiresAt: item.expiresAt,
  };
}

export function documentCounterQuery(
  tableName: string,
  client = DynamoDBDocumentClient.from(new DynamoDBClient({})),
): CounterQuery {
  return {
    async queryDay(statDay, exclusiveStartKey) {
      const input: QueryCommandInput = {
        TableName: tableName,
        KeyConditionExpression: "#statDay = :statDay",
        ExpressionAttributeNames: { "#statDay": "statDay" },
        ExpressionAttributeValues: { ":statDay": statDay },
        ExclusiveStartKey: exclusiveStartKey as QueryCommandInput["ExclusiveStartKey"],
      };
      const result = await client.send(new QueryCommand(input));
      return {
        items: (result.Items ?? []) as Record<string, unknown>[],
        lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
      };
    },
  };
}
