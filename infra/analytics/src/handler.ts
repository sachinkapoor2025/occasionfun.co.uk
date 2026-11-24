import { ingestPageView, type IngestResult } from "@/lib/analytics/recovery";
import { analyticsStores, documentRequests, type DynamoRequest } from "./dynamo-store";

export const MAX_COLLECT_BODY_BYTES = 8192;

export type CollectEvent = {
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
};

type CollectResponse = {
  statusCode: number;
  headers: { "content-type": string };
  body: string;
};

export type CollectDependencies = {
  visitorsTable: string;
  pageViewsTable: string;
  dynamo: DynamoRequest;
  now: () => Date;
};

function json(
  statusCode: number,
  body: { code: string; retry: boolean; reason?: string },
): CollectResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function collectStatus(result: IngestResult): number {
  if (result.code === "accepted") return 202;
  if (result.code === "event_unavailable") return 503;
  if (result.code === "rejected") return 400;
  return 409;
}

function decodeBody(event: CollectEvent): string | null {
  if (typeof event.body !== "string") return null;
  if (!event.isBase64Encoded) return event.body;
  try {
    return Buffer.from(event.body, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function handleCollect(event: CollectEvent, dependencies: CollectDependencies): Promise<CollectResponse> {
  if (event.requestContext?.http?.method !== "POST") {
    return json(405, { code: "rejected", retry: false });
  }
  if (!dependencies.visitorsTable || !dependencies.pageViewsTable) {
    return json(503, { code: "event_unavailable", retry: true });
  }
  const raw = decodeBody(event);
  if (raw === null) return json(400, { code: "rejected", retry: false, reason: "invalid_body" });
  if (Buffer.byteLength(raw) > MAX_COLLECT_BODY_BYTES) {
    return json(413, { code: "rejected", retry: false, reason: "invalid_body" });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return json(400, { code: "rejected", retry: false, reason: "invalid_body" });
  }
  const result = await ingestPageView(
    body,
    analyticsStores(dependencies.visitorsTable, dependencies.pageViewsTable, dependencies.dynamo),
    dependencies.now(),
  );
  return json(collectStatus(result), {
    code: result.code,
    retry: result.retry,
    ...(result.reason ? { reason: result.reason } : {}),
  });
}

export async function handler(event: CollectEvent): Promise<CollectResponse> {
  return handleCollect(event, {
    visitorsTable: process.env.VISITORS_TABLE_NAME ?? "",
    pageViewsTable: process.env.PAGE_VIEWS_TABLE_NAME ?? "",
    dynamo: documentRequests(),
    now: () => new Date(),
  });
}
