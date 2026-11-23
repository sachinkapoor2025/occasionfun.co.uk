"use client";

import { useEffect, useState } from "react";
import { currentAccessToken } from "@/lib/admin/auth";
import {
  fetchEnquiries,
  fetchEnquiry,
  fetchEnquirySummary,
  notificationStatuses,
  type Enquiry,
  type EnquirySummary,
  type NotificationStatus,
} from "@/lib/admin/api";

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: Enquiry[]; cursor: string | null };

type FetchedList = {
  key: string;
  result: Exclude<ListState, { status: "loading" }>;
};

type SummaryView =
  | { status: "loading" }
  | { status: "error" }
  | Extract<EnquirySummary, { status: "ok" }>;

export function NotificationBoard({ onUnauthorised }: { onUnauthorised: () => void }) {
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("pending");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fetchedSummary, setFetchedSummary] = useState<{ key: number; result: Exclude<SummaryView, { status: "loading" }> } | null>(null);
  const [fetchedList, setFetchedList] = useState<FetchedList | null>(null);
  const listKey = `${notificationStatus}\u0000${cursor ?? ""}\u0000${reload}`;
  const list: ListState = fetchedList?.key === listKey ? fetchedList.result : { status: "loading" };
  const summary: SummaryView = fetchedSummary?.key === reload ? fetchedSummary.result : { status: "loading" };

  useEffect(() => {
    let cancelled = false;
    const key = reload;
    void (async () => {
      const access = await currentAccessToken();
      if (cancelled) return;
      if (access.status !== "token") {
        onUnauthorised();
        return;
      }
      const result = await fetchEnquirySummary(access.token);
      if (cancelled) return;
      if (result.status === "unauthorized") {
        onUnauthorised();
        return;
      }
      setFetchedSummary({
        key,
        result: result.status === "ok" ? result : { status: "error" },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, onUnauthorised]);

  useEffect(() => {
    let cancelled = false;
    const key = listKey;
    void (async () => {
      const access = await currentAccessToken();
      if (cancelled) return;
      if (access.status !== "token") {
        onUnauthorised();
        return;
      }
      const result = await fetchEnquiries(access.token, { status: notificationStatus, cursor });
      if (cancelled) return;
      if (result.status === "unauthorized") {
        onUnauthorised();
        return;
      }
      if (result.status !== "ok") {
        setFetchedList({ key, result: { status: "error" } });
        return;
      }
      setFetchedList({
        key,
        result: { status: "ready", items: result.items, cursor: result.cursor },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [listKey, notificationStatus, cursor, onUnauthorised]);

  function chooseStatus(status: NotificationStatus) {
    setNotificationStatus(status);
    setHistory([]);
    setCursor(null);
    setSelectedId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Recipients, the sender address, and the message text are configured on the contact service. This panel reads delivery results only.
        </p>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-navy-900"
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {notificationStatuses.map((status) => {
          const count = summary.status === "ok" ? String(summary.byNotificationStatus[status]) : null;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={notificationStatus === status}
              className={`rounded-lg border p-4 text-left ${
                notificationStatus === status ? "border-accent bg-surface" : "border-slate-200 bg-surface"
              }`}
              onClick={() => chooseStatus(status)}
            >
              <span className="block text-sm font-semibold capitalize text-navy-900">{status}</span>
              <span className="mt-2 block text-sm font-semibold text-slate-700">
                {summary.status === "loading" ? "Loading…" : count ?? "Could not be loaded"}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
        <li>Pending notifications that are due are retried automatically.</li>
        <li>Abandoned sending attempts can be recovered.</li>
        <li>Failed notifications are terminal and are not retried automatically.</li>
        <li>The retry worker runs every five minutes.</li>
        <li>Each notification allows a maximum of six claims.</li>
      </ul>
      <label className="block max-w-xs text-sm font-semibold text-navy-900">
        Notification status
        <select
          className="mt-1 block w-full rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
          value={notificationStatus}
          onChange={(event) => chooseStatus(event.target.value as NotificationStatus)}
        >
          {notificationStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm leading-6 text-slate-600">
        Notifications are ordered by notification due time, newest first. The Submitted column shows the original enquiry submission. Retry activity can affect the list order.
      </p>
      {list.status === "loading" ? <p className="text-sm text-slate-600">Loading notifications…</p> : null}
      {list.status === "error" ? (
        <p className="text-sm text-slate-600">
          Notification delivery records could not be loaded.{" "}
          <button type="button" className="font-semibold text-accent" onClick={() => setReload((value) => value + 1)}>
            Try again
          </button>
        </p>
      ) : null}
      {list.status === "ready" && list.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-surface px-4 py-5 text-sm text-slate-600">
          {list.cursor
            ? "No matching notifications on this page. More records are available."
            : "No notifications in this status."}
        </p>
      ) : null}
      {list.status === "ready" && list.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-surface">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Email notifications</caption>
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Enquiry reference</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Attempts</th>
                <th className="px-4 py-3 font-semibold">Last error</th>
                <th className="px-4 py-3 font-semibold">Sent</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Open</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono" title={item.id}>
                    {item.id.slice(0, 12)}
                  </td>
                  <td className="px-4 py-3 font-semibold">{item.name}</td>
                  <td className="px-4 py-3">{item.email}</td>
                  <td className="px-4 py-3 capitalize">{item.notificationStatus}</td>
                  <td className="px-4 py-3">{attemptsLabel(item.notificationAttempts)}</td>
                  <td className="px-4 py-3">{errorLabel(item.lastNotificationError)}</td>
                  <td className="px-4 py-3">{sentLabel(item.notifiedAt)}</td>
                  <td className="px-4 py-3">{formatWhen(item.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-semibold text-accent"
                      onClick={() => setSelectedId(item.id)}
                    >
                      View notification for {item.name}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={history.length === 0}
          onClick={() => {
            const previous = history[history.length - 1] ?? null;
            setHistory((value) => value.slice(0, -1));
            setCursor(previous);
            setSelectedId(null);
          }}
        >
          Previous page
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={list.status !== "ready" || !list.cursor}
          onClick={() => {
            if (list.status !== "ready" || !list.cursor) return;
            setHistory((value) => [...value, cursor]);
            setCursor(list.cursor);
            setSelectedId(null);
          }}
        >
          Next page
        </button>
      </div>
      {selectedId ? (
        <NotificationDetail id={selectedId} reload={reload} onUnauthorised={onUnauthorised} />
      ) : null}
    </div>
  );
}

function NotificationDetail({
  id,
  reload,
  onUnauthorised,
}: {
  id: string;
  reload: number;
  onUnauthorised: () => void;
}) {
  const [fetched, setFetched] = useState<{ key: string; state: "missing" | "error" | Enquiry } | null>(null);
  const key = `${id}\u0000${reload}`;
  const state = fetched?.key === key ? fetched.state : "loading";

  useEffect(() => {
    let cancelled = false;
    const requestKey = key;
    void (async () => {
      const access = await currentAccessToken();
      if (cancelled) return;
      if (access.status !== "token") {
        onUnauthorised();
        return;
      }
      const result = await fetchEnquiry(access.token, id);
      if (cancelled) return;
      if (result.status === "unauthorized") {
        onUnauthorised();
        return;
      }
      if (result.status === "missing") {
        setFetched({ key: requestKey, state: "missing" });
        return;
      }
      if (result.status !== "ok") {
        setFetched({ key: requestKey, state: "error" });
        return;
      }
      setFetched({ key: requestKey, state: result.enquiry });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, key, onUnauthorised]);

  if (state === "loading") return <p className="text-sm text-slate-600">Loading notification…</p>;
  if (state === "missing") return <p className="text-sm text-slate-600">This notification is no longer available.</p>;
  if (state === "error") return <p className="text-sm text-slate-600">The notification could not be loaded.</p>;

  return (
    <article className="rounded-lg border border-slate-200 bg-surface p-4">
      <h2 className="font-display text-2xl">{state.name}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        This notification belongs to the enquiry submitted by {state.name}.
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Enquiry reference</dt>
          <dd className="break-all font-mono">{state.id}</dd>
        </div>
        <div>
          <dt className="font-semibold">Email</dt>
          <dd>{state.email}</dd>
        </div>
        <div>
          <dt className="font-semibold">Organisation</dt>
          <dd>{state.organisation}</dd>
        </div>
        <div>
          <dt className="font-semibold">Enquiry type</dt>
          <dd>{state.enquiryType}</dd>
        </div>
        <div>
          <dt className="font-semibold">Notification status</dt>
          <dd className="capitalize">{state.notificationStatus}</dd>
        </div>
        <div>
          <dt className="font-semibold">Attempts</dt>
          <dd>{attemptsLabel(state.notificationAttempts)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Last error</dt>
          <dd>{errorLabel(state.lastNotificationError)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Sent</dt>
          <dd>{sentLabel(state.notifiedAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Submitted</dt>
          <dd>{formatWhen(state.submittedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

function attemptsLabel(value: number | undefined) {
  return value === undefined ? "Not recorded" : String(value);
}

function errorLabel(value: string | undefined) {
  return value ?? "None recorded";
}

function sentLabel(value: string | undefined) {
  return value ? formatWhen(value) : "Not sent";
}

function formatWhen(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
