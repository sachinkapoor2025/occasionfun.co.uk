import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const nodeHttps = createRequire(import.meta.url)("node:https") as {
  request: (url: string, options: RequestOptions, callback: () => void) => ClientRequest;
};

type Outcome = { statusCode: number; body: Buffer } | { error: Error };

const original = nodeHttps.request;
const urls: string[] = [];
let outcome: Outcome | undefined;

function uriOf(url: unknown): string {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.toString();
  return "";
}

function patched(url: unknown, options?: unknown, callback?: unknown): ClientRequest {
  if (!outcome) {
    return original.call(
      nodeHttps,
      url as string,
      options as RequestOptions,
      callback as () => void,
    );
  }
  urls.push(uriOf(url));
  const onResponse = typeof options === "function" ? options : callback;
  const current = outcome;
  const req = new EventEmitter() as ClientRequest;
  req.end = (() => {
    if ("error" in current) {
      queueMicrotask(() => req.emit("error", current.error));
    } else {
      const incoming = Readable.from([current.body]) as IncomingMessage;
      incoming.statusCode = current.statusCode;
      queueMicrotask(() => {
        if (typeof onResponse === "function") onResponse(incoming);
      });
    }
    return req;
  }) as ClientRequest["end"];
  req.destroy = (() => req) as ClientRequest["destroy"];
  return req;
}

Object.defineProperty(nodeHttps, "request", {
  configurable: true,
  writable: true,
  value: patched,
});

export function installJwksTransport(next: Outcome): { urls: string[] } {
  urls.length = 0;
  outcome = next;
  return { urls };
}

export function clearJwksTransport(): void {
  outcome = undefined;
  urls.length = 0;
}
