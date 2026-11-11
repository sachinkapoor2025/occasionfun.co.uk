import { describe, expect, it } from "vitest";
import { company } from "../../../src/config/company";
import {
  LOCK_TIMEOUT_MS,
  RETENTION_SECONDS,
  SMTP_ATTEMPTS,
  enquirySubject,
  expiresAtEpoch,
  idempotencyKey,
  processEnquiry,
  retryDueNotifications,
  type ClaimResult,
  type ContactHttpEvent,
  type EnquiryDeps,
  type LeadRecord,
  type LeadStore,
} from "../src/process-enquiry";

const now = new Date("2026-11-10T12:00:00.000Z");
const later = new Date("2026-11-11T12:00:00.000Z");

const input = {
  name: "Ada Lovelace",
  organisation: "Analytical Engines",
  email: "ada@example.com",
  phone: "02079460000",
  enquiryType: "Software development" as const,
  message: "We need a short discovery conversation about a public website.",
  consent: true as const,
  companyWebsite: "",
};

function event(
  body: unknown = input,
  headers: Record<string, string> = { "content-type": "application/json" },
): ContactHttpEvent {
  return {
    body: JSON.stringify(body),
    isBase64Encoded: false,
    headers,
    requestContext: { http: { method: "POST" } },
  };
}

function withoutOwner(current: LeadRecord, patch: Partial<LeadRecord>): LeadRecord {
  const next: LeadRecord = { ...current, ...patch };
  delete next.sendingOwner;
  return next;
}

function named(name: string): Error {
  return Object.assign(new Error(name), { name });
}

function createStore(options?: {
  failInsert?: boolean;
  failMarkSent?: boolean;
}) {
  const leads = new Map<string, LeadRecord>();
  let chain = Promise.resolve();
  let claimCount = 0;
  let claimWaiter: (() => void) | undefined;
  const exclusive = <T>(fn: () => T): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const store: LeadStore = {
    insert(lead) {
      return exclusive(() => {
        if (options?.failInsert) throw named("DynamoDbError");
        if (leads.has(lead.idempotencyKey)) return "duplicate" as const;
        leads.set(lead.idempotencyKey, structuredClone(lead));
        return "created" as const;
      });
    },
    read(key) {
      return exclusive(() => {
        const lead = leads.get(key);
        return lead ? structuredClone(lead) : null;
      });
    },
    claim(key, owner, claimNow, claimOptions) {
      return exclusive((): ClaimResult => {
        claimCount += 1;
        claimWaiter?.();
        const current = leads.get(key);
        if (!current) return { outcome: "missing" };
        if (current.notificationStatus === "sent") {
          return { outcome: "sent", lead: structuredClone(current) };
        }
        if (current.notificationStatus === "failed") {
          return { outcome: "failed", lead: structuredClone(current) };
        }
        const staleBefore = new Date(
          claimNow.getTime() - LOCK_TIMEOUT_MS,
        ).toISOString();
        const pending =
          current.notificationStatus === "pending" &&
          (!claimOptions.respectSchedule ||
            current.notificationDueAt <= claimNow.toISOString());
        const expired =
          current.notificationStatus === "sending" &&
          current.notificationDueAt <= staleBefore;
        if (!pending && !expired) {
          return { outcome: "busy", lead: structuredClone(current) };
        }
        const next: LeadRecord = {
          ...current,
          notificationStatus: "sending",
          sendingStartedAt: claimNow.toISOString(),
          sendingOwner: owner,
          notificationDueAt: claimNow.toISOString(),
          notificationAttempts: current.notificationAttempts + 1,
        };
        leads.set(key, next);
        return { outcome: "claimed", lead: structuredClone(next) };
      });
    },
    markSent(key, owner) {
      return exclusive(() => {
        if (options?.failMarkSent) throw named("UpdateFailed");
        const current = leads.get(key);
        if (
          !current ||
          current.notificationStatus !== "sending" ||
          current.sendingOwner !== owner
        ) {
          return "lost" as const;
        }
        leads.set(key, withoutOwner(current, { notificationStatus: "sent" }));
        return "updated" as const;
      });
    },
    markPending(key, owner, errorName, dueAt) {
      return exclusive(() => {
        const current = leads.get(key);
        if (
          !current ||
          current.notificationStatus !== "sending" ||
          current.sendingOwner !== owner
        ) {
          return "lost" as const;
        }
        leads.set(
          key,
          withoutOwner(current, {
            notificationStatus: "pending",
            notificationDueAt: dueAt,
            lastNotificationError: errorName,
          }),
        );
        return "updated" as const;
      });
    },
    markFailed(key, owner, errorName) {
      return exclusive(() => {
        const current = leads.get(key);
        if (
          !current ||
          current.notificationStatus !== "sending" ||
          current.sendingOwner !== owner
        ) {
          return "lost" as const;
        }
        leads.set(
          key,
          withoutOwner(current, {
            notificationStatus: "failed",
            lastNotificationError: errorName,
          }),
        );
        return "updated" as const;
      });
    },
    listDue(status, dueBefore, limit) {
      return exclusive(() =>
        [...leads.values()]
          .filter(
            (lead) =>
              lead.notificationStatus === status &&
              lead.notificationDueAt <= dueBefore,
          )
          .slice(0, limit)
          .map((lead) => structuredClone(lead)),
      );
    },
  };

  return {
    store,
    waitForClaims(count: number) {
      if (claimCount >= count) return Promise.resolve();
      return new Promise<void>((resolve) => {
        claimWaiter = () => {
          if (claimCount >= count) resolve();
        };
      });
    },
    seed(lead: LeadRecord) {
      leads.set(lead.idempotencyKey, structuredClone(lead));
    },
    get(key: string) {
      const lead = leads.get(key);
      return lead ? structuredClone(lead) : undefined;
    },
  };
}

function deps(
  store: LeadStore,
  sendMail: EnquiryDeps["sendMail"],
  clock: Date = now,
): EnquiryDeps {
  return {
    store,
    sendMail,
    now: () => clock,
    sleep: async () => undefined,
    newId: () => "lead-1",
    newOwner: (() => {
      let n = 0;
      return () => `owner-${++n}`;
    })(),
  };
}

function bodyOf(result: { body: string }) {
  return JSON.parse(result.body) as {
    ok: boolean;
    saved: boolean;
    notification: string;
    message: string;
  };
}

function storedLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  const key = idempotencyKey(input, "2026-11-10");
  return {
    idempotencyKey: key,
    leadId: "existing",
    createdAt: "2026-11-10T11:00:00.000Z",
    expiresAt: expiresAtEpoch(now),
    name: input.name,
    organisation: input.organisation,
    email: input.email,
    phone: input.phone,
    enquiryType: input.enquiryType,
    message: input.message,
    consent: true,
    notificationStatus: "pending",
    notificationAttempts: 0,
    notificationDueAt: "2026-11-10T11:00:00.000Z",
    ...overrides,
  };
}

describe("processEnquiry", () => {
  it("sends once when two requests for the same enquiry run together", async () => {
    const harness = createStore();
    let sends = 0;
    const sendMail = async () => {
      sends += 1;
      await harness.waitForClaims(2);
    };
    const [first, second] = await Promise.all([
      processEnquiry(event(), deps(harness.store, sendMail)),
      processEnquiry(event(), deps(harness.store, sendMail)),
    ]);
    const notifications = [bodyOf(first).notification, bodyOf(second).notification].sort();

    expect(sends).toBe(1);
    expect(bodyOf(first).saved).toBe(true);
    expect(bodyOf(second).saved).toBe(true);
    expect(notifications).toEqual(["sending", "sent"]);
  });

  it("does not send when another invocation holds a recent sending lock", async () => {
    const harness = createStore();
    harness.seed(
      storedLead({
        notificationStatus: "sending",
        notificationAttempts: 1,
        sendingOwner: "other-invocation",
        sendingStartedAt: now.toISOString(),
        notificationDueAt: now.toISOString(),
      }),
    );
    const sendMail = async () => {
      throw named("ShouldNotSend");
    };

    const result = await processEnquiry(event(), deps(harness.store, sendMail));
    const body = bodyOf(result);

    expect(result.statusCode).toBe(202);
    expect(body).toMatchObject({
      ok: true,
      saved: true,
      notification: "sending",
    });
    expect(body.message).toContain("already being processed");
  });

  it("recovers an expired sending lock and sends once", async () => {
    const harness = createStore();
    const expired = new Date(now.getTime() - LOCK_TIMEOUT_MS - 1000).toISOString();
    harness.seed(
      storedLead({
        notificationStatus: "sending",
        notificationAttempts: 1,
        sendingOwner: "abandoned",
        sendingStartedAt: expired,
        notificationDueAt: expired,
      }),
    );
    let sends = 0;
    const result = await processEnquiry(
      event(),
      deps(harness.store, async () => {
        sends += 1;
      }),
    );

    expect(sends).toBe(1);
    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toMatchObject({
      ok: true,
      saved: true,
      notification: "sent",
    });
    expect(harness.get(storedLead().idempotencyKey)?.notificationAttempts).toBe(2);
  });

  it("marks the lead sent after SMTP accepts the message", async () => {
    const harness = createStore();
    const result = await processEnquiry(
      event(),
      deps(harness.store, async () => undefined),
    );
    const stored = harness.get(idempotencyKey(input, "2026-11-10"));

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toMatchObject({
      ok: true,
      saved: true,
      notification: "sent",
    });
    expect(stored?.notificationStatus).toBe("sent");
    expect(stored?.notificationAttempts).toBe(1);
  });

  it("returns the lead to pending when SMTP fails and this invocation owns the lock", async () => {
    const harness = createStore();
    let sends = 0;
    const result = await processEnquiry(
      event(),
      deps(harness.store, async () => {
        sends += 1;
        throw named("SmtpError");
      }),
    );
    const stored = harness.get(idempotencyKey(input, "2026-11-10"));

    expect(sends).toBe(SMTP_ATTEMPTS);
    expect(result.statusCode).toBe(502);
    expect(bodyOf(result)).toMatchObject({
      ok: false,
      saved: true,
      notification: "pending",
    });
    expect(stored?.notificationStatus).toBe("pending");
    expect(stored?.sendingOwner).toBeUndefined();
    expect(stored?.lastNotificationError).toBe("SmtpError");
    expect(stored?.notificationAttempts).toBe(1);
  });

  it("does not send when the database insert fails", async () => {
    const harness = createStore({ failInsert: true });
    let sends = 0;
    const result = await processEnquiry(
      event(),
      deps(harness.store, async () => {
        sends += 1;
      }),
    );

    expect(sends).toBe(0);
    expect(result.statusCode).toBe(503);
    expect(bodyOf(result)).toMatchObject({
      ok: false,
      saved: false,
      notification: "none",
    });
  });

  it("does not report a sent notification when markSent fails", async () => {
    const harness = createStore({ failMarkSent: true });
    let sends = 0;
    const result = await processEnquiry(
      event(),
      deps(harness.store, async () => {
        sends += 1;
      }),
    );

    expect(sends).toBe(1);
    expect(result.statusCode).toBe(502);
    expect(bodyOf(result)).toMatchObject({
      ok: false,
      saved: true,
      notification: "pending",
    });
    expect(bodyOf(result).message).not.toContain("has been received");
  });

  it("creates a new lead for the same enquiry on a different day", async () => {
    const harness = createStore();
    let sends = 0;
    const sendMail = async () => {
      sends += 1;
    };
    await processEnquiry(event(), deps(harness.store, sendMail, now));
    await processEnquiry(event(), deps(harness.store, sendMail, later));

    expect(idempotencyKey(input, "2026-11-10")).not.toBe(
      idempotencyKey(input, "2026-11-11"),
    );
    expect(sends).toBe(2);
    expect(harness.get(idempotencyKey(input, "2026-11-10"))).toBeDefined();
    expect(harness.get(idempotencyKey(input, "2026-11-11"))).toBeDefined();
  });

  it("marks the notification failed when the retry limit is already exhausted", async () => {
    const harness = createStore();
    harness.seed(storedLead({ notificationAttempts: 6 }));
    let sends = 0;
    const result = await processEnquiry(
      event(),
      deps(harness.store, async () => {
        sends += 1;
      }),
    );
    const stored = harness.get(storedLead().idempotencyKey);

    expect(sends).toBe(0);
    expect(bodyOf(result)).toMatchObject({
      ok: false,
      saved: true,
      notification: "failed",
    });
    expect(stored?.notificationStatus).toBe("failed");
    expect(stored?.lastNotificationError).toBe("RetryLimitReached");
    expect(stored?.notificationAttempts).toBe(7);
  });

  it("stores a retention timestamp 365 days after creation", async () => {
    const harness = createStore();
    await processEnquiry(
      event(),
      deps(harness.store, async () => undefined),
    );
    const stored = harness.get(idempotencyKey(input, "2026-11-10"));

    expect(stored?.expiresAt).toBe(expiresAtEpoch(now));
    expect(stored?.expiresAt).toBe(
      Math.floor(now.getTime() / 1000) + RETENTION_SECONDS,
    );
  });
});

describe("retryDueNotifications", () => {
  it("sends due pending notifications and expired locks, and skips a current lock", async () => {
    const harness = createStore();
    const expired = new Date(now.getTime() - LOCK_TIMEOUT_MS - 1000).toISOString();
    harness.seed(storedLead());
    harness.seed(
      storedLead({
        idempotencyKey: "expired-lock",
        notificationStatus: "sending",
        notificationAttempts: 1,
        sendingOwner: "abandoned",
        notificationDueAt: expired,
      }),
    );
    harness.seed(
      storedLead({
        idempotencyKey: "current-lock",
        notificationStatus: "sending",
        notificationAttempts: 1,
        sendingOwner: "live",
        notificationDueAt: now.toISOString(),
      }),
    );
    harness.seed(
      storedLead({
        idempotencyKey: "future-pending",
        notificationDueAt: "2026-11-10T13:00:00.000Z",
      }),
    );

    const sent: string[] = [];
    const summary = await retryDueNotifications(
      deps(harness.store, async (lead) => {
        sent.push(lead.idempotencyKey);
      }),
    );

    expect(sent.sort()).toEqual(
      [storedLead().idempotencyKey, "expired-lock"].sort(),
    );
    expect(summary.sent).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(harness.get("current-lock")?.notificationStatus).toBe("sending");
    expect(harness.get("future-pending")?.notificationStatus).toBe("pending");
    expect(harness.get("future-pending")?.notificationAttempts).toBe(0);
  });

  it("does not send a second notification when two retries claim the same lead", async () => {
    const harness = createStore();
    harness.seed(storedLead());
    let sends = 0;
    const [first, second] = await Promise.all([
      retryDueNotifications(
        deps(harness.store, async () => {
          sends += 1;
        }),
      ),
      retryDueNotifications(
        deps(harness.store, async () => {
          sends += 1;
        }),
      ),
    ]);

    expect(sends).toBe(1);
    expect(first.sent + second.sent).toBeGreaterThanOrEqual(1);
    expect(harness.get(storedLead().idempotencyKey)?.notificationStatus).toBe("sent");
  });

  it("does not release a sending lock owned by another invocation", async () => {
    const harness = createStore();
    const key = storedLead().idempotencyKey;
    harness.seed(
      storedLead({
        notificationStatus: "sending",
        sendingOwner: "owner-a",
        notificationAttempts: 1,
        notificationDueAt: now.toISOString(),
      }),
    );

    await expect(
      harness.store.markPending(key, "owner-b", "SmtpError", now.toISOString()),
    ).resolves.toBe("lost");
    await expect(harness.store.markSent(key, "owner-b")).resolves.toBe("lost");

    expect(harness.get(key)?.notificationStatus).toBe("sending");
    expect(harness.get(key)?.sendingOwner).toBe("owner-a");
  });
});

describe("notification subject prefix", () => {
  const enquiryType = "Software development";
  const base = `${company.legalName} enquiry: ${enquiryType}`;

  it("prefixes demo notifications and leaves the enquiry text unchanged", () => {
    expect(enquirySubject(enquiryType, "[DEMO]")).toBe(`[DEMO] ${base}`);
  });

  it("prefixes production notifications and leaves the enquiry text unchanged", () => {
    expect(enquirySubject(enquiryType, "[PROD]")).toBe(`[PROD] ${base}`);
  });

  it("keeps the existing subject when a deployment has no prefix", () => {
    expect(enquirySubject(enquiryType)).toBe(base);
    expect(enquirySubject(enquiryType, "  ")).toBe(base);
  });

  it("removes line breaks from the prefix and the enquiry type", () => {
    expect(enquirySubject("Hello\r\nthere", "[DEMO]\n")).toBe(
      `[DEMO] ${company.legalName} enquiry: Hello  there`,
    );
  });
});
