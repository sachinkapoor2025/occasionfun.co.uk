export type HttpResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export function jsonResult(statusCode: number, body: Json): HttpResult {
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
  verificationStage?: "parse" | "jwks" | "import_key" | "signature";
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
  if (
    entry.verificationStage === "parse" ||
    entry.verificationStage === "jwks" ||
    entry.verificationStage === "import_key" ||
    entry.verificationStage === "signature"
  ) {
    payload.verificationStage = entry.verificationStage;
  }
  console.info(JSON.stringify(payload));
}
