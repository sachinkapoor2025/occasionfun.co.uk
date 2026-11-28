/**
 * Identifier-free aggregate measurement for the public site.
 * The body is only { pagePath, landing }. Country, source, device, and
 * browser stay on the server. This client does not read consent and does
 * not use the individual collector's queue.
 *
 * Retries are intentionally absent. The aggregate writer has no event id:
 * each accepted body adds one to the counter. Sending a navigation again
 * counts it twice. HTTP 503 can mean the page view was stored and the
 * landing write then failed. HTTP 204 is a finished response, including
 * the disabled function, and is not a reason to send the body again. A
 * network error is also final, because the request may already have been
 * counted.
 */

import { normalisePagePath } from "./event-core";

/** Tab-level marker. The stored value is the constant "1", never an identifier. */
export const AGGREGATE_LANDING_FLAG_KEY = "occasionfun-aggregate-landing";

const LANDING_FLAG_VALUE = "1";

export type MeasureResult = "inactive" | "skipped" | "sent" | "failed";

export type MeasureClientOptions = {
  endpoint: string | undefined;
  fetchMeasure: (url: string, raw: string) => Promise<{ status: number }>;
  getPathname: () => string;
  getStorage?: () => Storage;
};

export type MeasureClient = {
  record: () => Promise<MeasureResult>;
};

export function measureBody(pagePath: string, landing: boolean): string {
  return JSON.stringify({ pagePath, landing });
}

/**
 * One POST. No second attempt is made from here.
 * referrerPolicy no-referrer keeps the document referrer off this request.
 * User-Agent and the connection address are not copied into the body.
 */
export function postMeasure(url: string, raw: string): Promise<{ status: number }> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
    keepalive: true,
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
  }).then((response) => ({ status: response.status }));
}

export function createMeasureClient(options: MeasureClientOptions): MeasureClient {
  let lastPath: string | null = null;
  let chain: Promise<void> = Promise.resolve();

  async function step(): Promise<MeasureResult> {
    const endpoint = options.endpoint?.trim() ?? "";
    if (!endpoint) return "inactive";

    let pathname = "";
    try {
      pathname = options.getPathname();
    } catch {
      return "skipped";
    }

    const pagePath = normalisePagePath(pathname);
    if (!pagePath || lastPath === pagePath) return "skipped";

    const landing = claimLanding(options.getStorage ?? defaultStorage);
    if (landing === null) return "skipped";

    // Claim this path before the request so another render of the same
    // navigation cannot send a second body.
    lastPath = pagePath;
    try {
      const response = await options.fetchMeasure(endpoint, measureBody(pagePath, landing));
      if (response.status >= 200 && response.status < 300) return "sent";
      return "failed";
    } catch {
      return "failed";
    }
  }

  return {
    record() {
      const run = chain.then(step, step);
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

function defaultStorage(): Storage {
  return window.sessionStorage;
}

/**
 * The flag is written before the request. A failed send is not repeated,
 * and a later page in this tab must not become another landing if the
 * first request was already counted.
 * Returns null when the flag cannot be stored. Nothing is sent in that case.
 */
function claimLanding(readStorage: () => Storage): boolean | null {
  try {
    const storage = readStorage();
    const existing = storage.getItem(AGGREGATE_LANDING_FLAG_KEY);
    if (existing !== null && existing !== "") {
      if (existing !== LANDING_FLAG_VALUE) {
        storage.setItem(AGGREGATE_LANDING_FLAG_KEY, LANDING_FLAG_VALUE);
      }
      return false;
    }
    storage.setItem(AGGREGATE_LANDING_FLAG_KEY, LANDING_FLAG_VALUE);
    if (storage.getItem(AGGREGATE_LANDING_FLAG_KEY) !== LANDING_FLAG_VALUE) return null;
    return true;
  } catch {
    return null;
  }
}
