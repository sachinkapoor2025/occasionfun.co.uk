export type HttpResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export function jsonResult(
  statusCode: number,
  body: Record<string, string | boolean>,
): HttpResult {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

export function logEvent(entry: {
  requestId: string;
  route: string;
  status: number;
  error?: string;
}): void {
  const payload: Record<string, string | number> = {
    requestId: entry.requestId,
    route: entry.route,
    status: entry.status,
  };
  if (entry.error) payload.error = entry.error;
  console.info(JSON.stringify(payload));
}
