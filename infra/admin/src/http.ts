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
  errorName?: string;
  errorCode?: string;
  errorDetail?: string;
}): void {
  const payload: Record<string, string | number> = {
    requestId: entry.requestId,
    route: entry.route,
    status: entry.status,
  };
  if (entry.error) payload.error = entry.error;
  if (entry.errorName) payload.errorName = entry.errorName;
  if (entry.errorCode) payload.errorCode = entry.errorCode;
  if (entry.errorDetail) payload.errorDetail = entry.errorDetail;
  console.info(JSON.stringify(payload));
}
