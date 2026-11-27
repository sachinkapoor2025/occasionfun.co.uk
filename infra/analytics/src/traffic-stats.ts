/**
 * Atomic counters for aggregate measurement.
 * A landing measurement writes the page-view counter, then the visit counter.
 * If the visit write fails, the page-view counter may already have been
 * incremented. There is no event id, so that partial count is not rolled
 * back and is not deduplicated. The handler returns a failure either way.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, type UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
import type { AggregateMeasurement, AggregateMetric } from "@/lib/analytics/aggregate";

export const COUNTER_UPDATE_EXPRESSION =
  "ADD #count :one SET #metric = :metric, #country = :country, #pagePath = :pagePath, #source = :source, #deviceCategory = :deviceCategory, #browserCategory = :browserCategory, #expiresAt = :expiresAt";

export type CounterUpdate = {
  TableName: string;
  Key: { statDay: string; statKey: string };
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, string | number>;
};

export type TrafficUpdate = {
  update(input: CounterUpdate): Promise<void>;
};

export type StoreResult = "stored" | "partial" | "failed";

export function documentTrafficUpdates(
  client = DynamoDBDocumentClient.from(new DynamoDBClient({})),
): TrafficUpdate {
  return {
    async update(input) {
      await client.send(new UpdateCommand(input as UpdateCommandInput));
    },
  };
}

export async function storeAggregateMeasurement(
  tableName: string,
  measurement: AggregateMeasurement,
  dynamo: TrafficUpdate,
): Promise<StoreResult> {
  const pageView = await writeCounter(tableName, measurement, "page_view", measurement.pageViewKey, dynamo);
  if (pageView === "failed") return "failed";
  if (!measurement.visitKey) return "stored";
  const visit = await writeCounter(tableName, measurement, "visit", measurement.visitKey, dynamo);
  return visit === "failed" ? "partial" : "stored";
}

async function writeCounter(
  tableName: string,
  measurement: AggregateMeasurement,
  metric: AggregateMetric,
  statKey: string,
  dynamo: TrafficUpdate,
): Promise<"stored" | "failed"> {
  try {
    await dynamo.update({
      TableName: tableName,
      Key: { statDay: measurement.statDay, statKey },
      UpdateExpression: COUNTER_UPDATE_EXPRESSION,
      ExpressionAttributeNames: {
        "#count": "count",
        "#metric": "metric",
        "#country": "country",
        "#pagePath": "pagePath",
        "#source": "source",
        "#deviceCategory": "deviceCategory",
        "#browserCategory": "browserCategory",
        "#expiresAt": "expiresAt",
      },
      ExpressionAttributeValues: {
        ":one": 1,
        ":metric": metric,
        ":country": measurement.country,
        ":pagePath": measurement.pagePath,
        ":source": measurement.source,
        ":deviceCategory": measurement.deviceCategory,
        ":browserCategory": measurement.browserCategory,
        ":expiresAt": measurement.expiresAt,
      },
    });
    return "stored";
  } catch {
    return "failed";
  }
}
