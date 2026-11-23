"use client";

import { useEffect, useState, type FormEvent } from "react";
import { currentAccessToken } from "@/lib/admin/auth";
import {
  fetchEnquiries,
  fetchEnquiry,
  notificationStatuses,
  updateEnquiryReview,
  type Enquiry,
  type NotificationStatus,
  type ReviewStatus,
} from "@/lib/admin/api";

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: Enquiry[]; cursor: string | null };

type FetchedList = {
  key: string;
  result: Exclude<ListState, { status: "loading" }>;
};

export function EnquiryBoard({ onUnauthorised }: { onUnauthorised: () => void }) {
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("pending");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [fetchedList, setFetchedList] = useState<FetchedList | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listKey = `${notificationStatus}\u0000${appliedSearch}\u0000${cursor ?? ""}\u0000${reload}`;
  const list: ListState = fetchedList?.key === listKey ? fetchedList.result : { status: "loading" };

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
      const result = await fetchEnquiries(access.token, {
        status: notificationStatus,
        cursor,
        q: appliedSearch,
      });
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
  }, [listKey, notificationStatus, appliedSearch, cursor, onUnauthorised]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setHistory([]);
    setCursor(null);
    setAppliedSearch(search.trim());
    setSelectedId(null);
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={applySearch}>
        <label className="text-sm font-semibold text-navy-900">
          Notification status
          <select
            className="mt-1 block w-full rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
            value={notificationStatus}
            onChange={(event) => {
              setNotificationStatus(event.target.value as NotificationStatus);
              setHistory([]);
              setCursor(null);
              setSelectedId(null);
            }}
          >
            {notificationStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm font-semibold text-navy-900">
          Search
          <input
            className="mt-1 block w-full rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, organisation, or email"
          />
        </label>
        <button type="submit" className="self-end rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>
      <p className="text-sm leading-6 text-slate-600">
        Search looks in the selected notification status. Review status is separate from the notification email state.
      </p>
      <p className="text-sm leading-6 text-slate-600">
        Enquiries are ordered by notification due time, newest first. The Submitted column shows the original submission date and time. Retry activity can affect the list order.
      </p>
      {list.status === "loading" ? <p className="text-sm text-slate-600">Loading enquiries…</p> : null}
      {list.status === "error" ? (
        <p className="text-sm text-slate-600">
          The enquiry list could not be loaded.{" "}
          <button type="button" className="font-semibold text-accent" onClick={() => setReload((value) => value + 1)}>
            Try again
          </button>
        </p>
      ) : null}
      {list.status === "ready" && list.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-surface px-4 py-5 text-sm text-slate-600">
          {list.cursor
            ? "No matching enquiries on this page. More records are available."
            : "No enquiries in this notification status."}
        </p>
      ) : null}
      {list.status === "ready" && list.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-surface">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Enquiries</caption>
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Message</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Open</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{item.name}</p>
                    <p>{item.organisation}</p>
                    <p>{item.email}</p>
                  </td>
                  <td className="px-4 py-3">{item.enquiryType}</td>
                  <td className="px-4 py-3">{item.message}</td>
                  <td className="px-4 py-3">{item.submittedAt.replace("T", " ").slice(0, 16)}</td>
                  <td className="px-4 py-3">
                    {item.notificationStatus} · {item.reviewStatus}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="font-semibold text-accent" onClick={() => setSelectedId(item.id)}>
                      View {item.name}
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
        <EnquiryDetail
          id={selectedId}
          onUnauthorised={onUnauthorised}
          onUpdated={(enquiry) => {
            setFetchedList((current) =>
              current?.key === listKey && current.result.status === "ready"
                ? {
                    ...current,
                    result: {
                      ...current.result,
                      items: current.result.items.map((item) =>
                        item.id === enquiry.id ? { ...item, reviewStatus: enquiry.reviewStatus } : item,
                      ),
                    },
                  }
                : current,
            );
          }}
        />
      ) : null}
    </div>
  );
}

function EnquiryDetail({
  id,
  onUnauthorised,
  onUpdated,
}: {
  id: string;
  onUnauthorised: () => void;
  onUpdated: (enquiry: Enquiry) => void;
}) {
  const [fetched, setFetched] = useState<
    { id: string; state: "missing" | "error" | Enquiry } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const state = fetched?.id === id ? fetched.state : "loading";

  useEffect(() => {
    let cancelled = false;
    const enquiryId = id;
    void (async () => {
      const access = await currentAccessToken();
      if (cancelled) return;
      if (access.status !== "token") {
        onUnauthorised();
        return;
      }
      const result = await fetchEnquiry(access.token, enquiryId);
      if (cancelled) return;
      if (result.status === "unauthorized") {
        onUnauthorised();
        return;
      }
      if (result.status === "missing") {
        setFetched({ id: enquiryId, state: "missing" });
        return;
      }
      if (result.status !== "ok") {
        setFetched({ id: enquiryId, state: "error" });
        return;
      }
      setFetched({ id: enquiryId, state: result.enquiry });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, onUnauthorised]);

  async function save(reviewStatus: ReviewStatus) {
    if (typeof state === "string") return;
    setSaving(true);
    setSaveError(false);
    const access = await currentAccessToken();
    if (access.status !== "token") {
      onUnauthorised();
      return;
    }
    const result = await updateEnquiryReview(access.token, state.id, reviewStatus);
    setSaving(false);
    if (result.status === "unauthorized") {
      onUnauthorised();
      return;
    }
    if (result.status !== "ok") {
      setSaveError(true);
      return;
    }
    setFetched({ id, state: result.enquiry });
    onUpdated(result.enquiry);
  }

  if (state === "loading") return <p className="text-sm text-slate-600">Loading enquiry…</p>;
  if (state === "missing") return <p className="text-sm text-slate-600">This enquiry is no longer available.</p>;
  if (state === "error") return <p className="text-sm text-slate-600">The enquiry could not be loaded.</p>;

  return (
    <article className="rounded-lg border border-slate-200 bg-surface p-4">
      <h2 className="font-display text-2xl">{state.name}</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Organisation</dt>
          <dd>{state.organisation}</dd>
        </div>
        <div>
          <dt className="font-semibold">Email</dt>
          <dd>{state.email}</dd>
        </div>
        <div>
          <dt className="font-semibold">Phone</dt>
          <dd>{state.phone ?? "No phone"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Subject</dt>
          <dd>{state.enquiryType}</dd>
        </div>
        <div>
          <dt className="font-semibold">Submitted</dt>
          <dd>{state.submittedAt.replace("T", " ").slice(0, 16)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Notification</dt>
          <dd>{state.notificationStatus}</dd>
        </div>
        <div>
          <dt className="font-semibold">Review</dt>
          <dd>{state.reviewStatus}</dd>
        </div>
      </dl>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{state.message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["new", "reviewed", "closed"] as const).map((review) => (
          <button
            key={review}
            type="button"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={saving || state.reviewStatus === review}
            onClick={() => void save(review)}
          >
            Mark {review}
          </button>
        ))}
      </div>
      {saveError ? <p className="mt-3 text-sm text-slate-600">The review status could not be saved.</p> : null}
    </article>
  );
}
