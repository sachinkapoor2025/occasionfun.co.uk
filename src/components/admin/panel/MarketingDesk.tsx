"use client";

import { useEffect, useState } from "react";
import { londonWallTimeToUtc } from "../../../lib/analytics/dates";
import { currentAccessToken } from "../../../lib/admin/auth";
import { marketingWorkspace } from "../../../lib/admin/marketing-api";
import { MarketingBoard } from "./MarketingBoard";

type Tab = "overview" | "contacts" | "campaigns" | "smtp";

const ADMIN_ERRORS: Record<string, string> = {
  duplicate_name: "Another campaign already uses that name.",
  invalid_campaign: "Add a name, subject, sender, reply-to address, message, and unsubscribe link.",
  invalid_schedule: "Use a future Europe/London time, finish the message, and include at least one eligible consented contact.",
  invalid_recipient: "Enter one valid email address for the test.",
  smtp_unconfigured: "Save the marketing SMTP settings before sending a test.",
  smtp_failed: "The mail server did not accept the message. The campaign was not started.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  campaign_locked: "Sending has started, so this campaign can no longer be edited.",
  unsubscribed_locked: "An unsubscribed contact stays suppressed and cannot be edited.",
  invalid_csv: "The CSV needs an email column.",
  csv_too_large: "That CSV is too large. Keep it within 500 rows and 256 KB.",
  invalid_contact: "Check the email address and names.",
  not_found: "That record is no longer available.",
  invalid_tag: "Use a short tag made of letters, numbers, or hyphens.",
  invalid_segment: "A segment needs a name and at least one tag.",
};

const fieldClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy-900";

export function MarketingDesk({ onUnauthorised }: { onUnauthorised: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [notice, setNotice] = useState("");
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [csv, setCsv] = useState("email,firstName,lastName,tags,consent\n");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [campaign, setCampaign] = useState({
    name: "",
    subject: "",
    senderName: "",
    senderEmail: "",
    replyTo: "",
    html: "<p>Hello {{firstName}},</p><p><a href=\"{{unsubscribeUrl}}\">Unsubscribe</a></p>",
    text: "Hello {{firstName}},\n\n{{unsubscribeUrl}}",
    scheduledAt: "",
  });
  const [segmentName, setSegmentName] = useState("");
  const [segmentTags, setSegmentTags] = useState("");
  const [audience, setAudience] = useState("all");
  const [excludeTags, setExcludeTags] = useState("");
  const [excludeEmails, setExcludeEmails] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<unknown[] | null>(null);
  const [draftId, setDraftId] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testFirstName, setTestFirstName] = useState("Alex");
  const [testResult, setTestResult] = useState("");
  const [preview, setPreview] = useState("");
  const [eligible, setEligible] = useState<number | null>(null);

  async function load() {
    const session = await currentAccessToken();
    if (session.status !== "token") {
      onUnauthorised();
      return;
    }
    const result = await marketingWorkspace(session.token, "GET");
    if (result.status === "unauthorized" || result.status === "forbidden") {
      onUnauthorised();
      return;
    }
    if (result.status === "ok") setWorkspace(result.body);
    else setNotice("The marketing workspace is not available yet.");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function post(body: Record<string, unknown>) {
    const session = await currentAccessToken();
    if (session.status !== "token") {
      onUnauthorised();
      return null;
    }
    const result = await marketingWorkspace(session.token, "POST", body);
    if (result.status === "unauthorized" || result.status === "forbidden") {
      onUnauthorised();
      return null;
    }
    if (result.status !== "ok") {
      setNotice(result.status === "error" ? ADMIN_ERRORS[result.error] ?? "That request was not accepted." : "That request was not accepted.");
      return null;
    }
    setNotice("");
    await load();
    return result.body;
  }

  const contacts = searchResults ?? (Array.isArray(workspace?.contacts) ? workspace.contacts : []);

  function criteria() {
    const tags = excludeTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const emails = excludeEmails.split(/[\s,]+/).map((email) => email.trim()).filter(Boolean);
    if (audience.startsWith("tag:")) {
      return { mode: "tags", tags: [audience.slice(4)], segmentId: null, excludeTags: tags, excludeEmails: emails };
    }
    if (audience.startsWith("segment:")) {
      return { mode: "segment", tags: [], segmentId: audience.slice(8), excludeTags: tags, excludeEmails: emails };
    }
    return { mode: "all", tags: [], segmentId: null, excludeTags: tags, excludeEmails: emails };
  }
  const campaigns = Array.isArray(workspace?.campaigns) ? workspace.campaigns : [];
  const activity = Array.isArray(workspace?.activity) ? workspace.activity : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Email marketing">
        {(["overview", "contacts", "campaigns", "smtp"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`rounded-full px-3 py-1 text-sm ${tab === item ? "bg-navy-900 text-white" : "bg-slate-100 text-navy-900"}`}
            onClick={() => setTab(item)}
          >
            {item === "smtp" ? "SMTP settings" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {notice ? <p className="text-sm text-slate-700" role="status">{notice}</p> : null}
      {tab === "overview" ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-surface p-4">
          <h2 className="font-display text-2xl text-navy-900">Email marketing</h2>
          <p className="text-sm leading-6 text-slate-600">
            Create a draft, preview it, send one test, then send now or schedule it for Europe/London. Accepted by SMTP
            means the mail server accepted the message. It is not a delivery receipt. Opens, clicks, bounces and complaints
            are unavailable.
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-3"><dt className="text-sm text-slate-600">Contacts</dt><dd className="font-display text-2xl text-navy-900">{typeof workspace?.contactCount === "number" ? workspace.contactCount : 0}</dd></div>
            <div className="rounded-md bg-slate-50 p-3"><dt className="text-sm text-slate-600">Campaigns</dt><dd className="font-display text-2xl text-navy-900">{campaigns.length}</dd></div>
            <div className="rounded-md bg-slate-50 p-3"><dt className="text-sm text-slate-600">Suppressed</dt><dd className="font-display text-2xl text-navy-900">{Array.isArray(workspace?.suppression) ? workspace.suppression.length : 0}</dd></div>
          </dl>
          <h3 className="font-display text-xl text-navy-900">Recent activity</h3>
          <ul className="text-sm text-slate-700">
            {activity.slice(0, 8).map((item, index) => {
              const entry = item as { action?: string; at?: string };
              return <li key={`${entry.at}-${index}`}>{entry.at} · {entry.action}</li>;
            })}
          </ul>
          {activity.length === 0 ? <p className="text-sm text-slate-600">No marketing activity yet.</p> : null}
        </section>
      ) : null}
      {tab === "smtp" ? <MarketingBoard onUnauthorised={onUnauthorised} /> : null}
      {tab === "contacts" ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-surface p-4">
          <h2 className="font-display text-2xl text-navy-900">Contacts</h2>
          <p className="text-sm leading-6 text-slate-600">
            A CSV row is eligible only when consent is granted. Importing an address does not grant marketing consent.
            {typeof workspace?.contactCount === "number" ? ` ${workspace.contactCount} contacts are stored.` : ""}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void post({
                action: "create-contact",
                email: String(data.get("email") ?? ""),
                firstName: String(data.get("firstName") ?? ""),
                lastName: String(data.get("lastName") ?? ""),
                tags: String(data.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
                consentStatus: data.get("consent") === "granted" ? "granted" : "unknown",
                consentSource: "admin-form",
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} name="email" type="email" required placeholder="Email" aria-label="Email" />
              <input className={fieldClass} name="firstName" placeholder="First name" aria-label="First name" />
              <input className={fieldClass} name="lastName" placeholder="Last name" aria-label="Last name" />
              <input className={fieldClass} name="tags" placeholder="Tags, comma separated" aria-label="Tags" />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input name="consent" type="checkbox" value="granted" />
              Marketing consent was granted, with the source recorded as admin-form
            </label>
            <button className="mt-3 rounded-md bg-navy-900 px-3 py-2 text-sm text-white" type="submit">Add contact</button>
          </form>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void post({ action: "search-contacts", text: searchText }).then((body) => {
                setSearchResults(Array.isArray(body?.contacts) ? body.contacts : []);
              });
            }}
          >
            <input className={fieldClass} aria-label="Search contacts" placeholder="Search name or email" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm" type="submit">Search</button>
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm" type="button" onClick={() => setSearchResults(null)}>Clear search</button>
          </form>
          <label className="block text-sm text-slate-700">
            CSV import
            <textarea className={`${fieldClass} min-h-28 font-mono`} value={csv} onChange={(event) => setCsv(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={updateExisting} onChange={(event) => setUpdateExisting(event.target.checked)} />
              Update names and tags on existing contacts. Consent, unsubscribe, and suppression stay unchanged.
            </label>
            <button
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              type="button"
              onClick={() => void post({
                action: "import-contacts",
                csv,
                ...(updateExisting ? { updateFields: ["firstName", "lastName", "tags"] } : {}),
              })}
            >
              Import CSV
            </button>
            <button
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              type="button"
              onClick={() => {
                void post({ action: "export-contacts" }).then((body) => {
                  if (typeof body?.csv !== "string") return;
                  const url = URL.createObjectURL(new Blob([body.csv], { type: "text/csv;charset=utf-8" }));
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "marketing-contacts.csv";
                  link.click();
                  URL.revokeObjectURL(url);
                });
              }}
            >
              Export CSV
            </button>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {contacts.map((item) => {
              const contact = item as { id?: string; email?: string; subscriptionStatus?: string; consentStatus?: string };
              return (
                <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{contact.email} · {contact.subscriptionStatus} · {contact.consentStatus}</span>
                  <button className="text-sm underline" type="button" onClick={() => void post({ action: "archive-contact", id: contact.id })}>
                    Archive
                  </button>
                </li>
              );
            })}
          </ul>
          {contacts.length === 0 ? <p className="text-sm text-slate-600">No contacts on this page.</p> : null}
          <h3 className="font-display text-xl text-navy-900">Suppression</h3>
          <p className="text-sm text-slate-600">Unsubscribed addresses stay suppressed. Import cannot remove them or turn them into marketing consent.</p>
          <ul className="text-sm text-slate-700">
            {Array.isArray(workspace?.suppression) && workspace.suppression.length > 0
              ? (workspace.suppression as { email?: string; reason?: string }[]).map((entry) => (
                <li key={entry.email}>{entry.email} · {entry.reason}</li>
              ))
              : <li>No suppressed addresses.</li>}
          </ul>
          <h3 className="font-display text-xl text-navy-900">Tags and segments</h3>
          <p className="text-sm text-slate-600">Tags: {Array.isArray(workspace?.tags) && workspace.tags.length > 0 ? (workspace.tags as string[]).join(", ") : "none yet"}</p>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void post({ action: "save-segment", name: segmentName, tags: segmentTags.split(",").map((tag) => tag.trim()).filter(Boolean) });
            }}
          >
            <input className={fieldClass} aria-label="Segment name" placeholder="Segment name" value={segmentName} onChange={(event) => setSegmentName(event.target.value)} />
            <input className={fieldClass} aria-label="Segment tags" placeholder="Tags, comma separated" value={segmentTags} onChange={(event) => setSegmentTags(event.target.value)} />
            <button className="w-fit rounded-md border border-slate-200 px-3 py-2 text-sm" type="submit">Save segment</button>
          </form>
          <ul className="text-sm text-slate-700">
            {Array.isArray(workspace?.segments) ? (workspace.segments as { id?: string; name?: string; tags?: string[] }[]).map((segment) => (
              <li key={segment.id}>{segment.name}: {(segment.tags ?? []).join(", ")}</li>
            )) : null}
          </ul>
        </section>
      ) : null}
      {tab === "campaigns" ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-surface p-4">
          <h2 className="font-display text-2xl text-navy-900">Campaigns</h2>
          <p className="text-sm leading-6 text-slate-600">
            Schedule times use Europe/London and follow GMT and BST. Accepted by SMTP means the mail server accepted the
            message. It is not a delivery receipt. Opens, clicks, bounces and complaints are unavailable because this
            sender is generic SMTP. Bounce and complaint suppression requires authenticated provider feedback, which this
            sender does not provide.
          </p>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void post({
                action: "save-campaign",
                ...campaign,
                ...(draftId ? { id: draftId } : {}),
                criteria: criteria(),
              }).then((body) => {
                if (!body) return;
                const saved = body.campaign as { id?: string } | undefined;
                if (typeof saved?.id === "string") setDraftId(saved.id);
                setPreview(typeof (body.preview as { html?: string } | undefined)?.html === "string" ? (body.preview as { html: string }).html : "");
                setEligible(typeof body.eligibleCount === "number" ? body.eligibleCount : null);
              });
            }}
          >
            <label className="text-sm text-slate-700">
              Template
              <select
                className={fieldClass}
                aria-label="Email template"
                defaultValue=""
                onChange={(event) => {
                  const templates = Array.isArray(workspace?.templates) ? workspace.templates as { id?: string; subject?: string; html?: string; text?: string }[] : [];
                  const selected = templates.find((item) => item.id === event.target.value);
                  if (!selected) return;
                  setCampaign({
                    ...campaign,
                    subject: selected.subject ?? campaign.subject,
                    html: selected.html ?? campaign.html,
                    text: selected.text ?? campaign.text,
                  });
                }}
              >
                <option value="">Choose a template</option>
                {Array.isArray(workspace?.templates) ? (workspace.templates as { id?: string; name?: string }[]).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                )) : null}
              </select>
            </label>
            <input className={fieldClass} aria-label="Campaign name" placeholder="Campaign name" value={campaign.name} onChange={(event) => setCampaign({ ...campaign, name: event.target.value })} />
            <input className={fieldClass} aria-label="Subject" placeholder="Subject" value={campaign.subject} onChange={(event) => setCampaign({ ...campaign, subject: event.target.value })} />
            <input className={fieldClass} aria-label="Sender name" placeholder="Sender name" value={campaign.senderName} onChange={(event) => setCampaign({ ...campaign, senderName: event.target.value })} />
            <input className={fieldClass} aria-label="Sender email" placeholder="Sender email" value={campaign.senderEmail} onChange={(event) => setCampaign({ ...campaign, senderEmail: event.target.value })} />
            <input className={fieldClass} aria-label="Reply-to" placeholder="Reply-to" value={campaign.replyTo} onChange={(event) => setCampaign({ ...campaign, replyTo: event.target.value })} />
            <textarea className={`${fieldClass} min-h-28 font-mono`} aria-label="HTML content" value={campaign.html} onChange={(event) => setCampaign({ ...campaign, html: event.target.value })} />
            <textarea className={`${fieldClass} min-h-20 font-mono`} aria-label="Plain text" value={campaign.text} onChange={(event) => setCampaign({ ...campaign, text: event.target.value })} />
            <label className="text-sm text-slate-700">
              Recipients
              <select className={fieldClass} aria-label="Recipient selection" value={audience} onChange={(event) => setAudience(event.target.value)}>
                <option value="all">All eligible consented contacts</option>
                {Array.isArray(workspace?.tags) ? (workspace.tags as string[]).map((tag) => <option key={tag} value={`tag:${tag}`}>Tag: {tag}</option>) : null}
                {Array.isArray(workspace?.segments) ? (workspace.segments as { id?: string; name?: string }[]).map((segment) => (
                  <option key={segment.id} value={`segment:${segment.id}`}>Segment: {segment.name}</option>
                )) : null}
              </select>
            </label>
            <input className={fieldClass} aria-label="Exclude tags" placeholder="Exclude tags, comma separated" value={excludeTags} onChange={(event) => setExcludeTags(event.target.value)} />
            <input className={fieldClass} aria-label="Exclude emails" placeholder="Exclude emails, comma separated" value={excludeEmails} onChange={(event) => setExcludeEmails(event.target.value)} />
            <button className="w-fit rounded-md bg-navy-900 px-3 py-2 text-sm text-white" type="submit">Save draft and preview</button>
          </form>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draftId) {
                setTestResult("Save the draft before sending a test. A test does not start the campaign.");
                return;
              }
              void post({ action: "test-campaign", id: draftId, to: testTo, firstName: testFirstName }).then((body) => {
                if (!body) return;
                setTestResult(
                  body.smtpAccepted === true
                    ? "SMTP accepted this one test message. This is not delivery confirmation, and the campaign was not queued."
                    : "The test was not accepted by SMTP.",
                );
              });
            }}
          >
            <input className={fieldClass} aria-label="Test recipient" placeholder="One test address" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
            <input className={fieldClass} aria-label="Test first name" placeholder="First name for the test" value={testFirstName} onChange={(event) => setTestFirstName(event.target.value)} />
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm" type="submit">Send one test</button>
          </form>
          {testResult ? <p className="text-sm text-slate-700">{testResult}</p> : null}
          {eligible !== null ? <p className="text-sm text-slate-700">Eligible recipients with current consent: {eligible}</p> : null}
          {preview ? (
            <div className="grid gap-3 md:grid-cols-2">
              <iframe className="h-48 w-full rounded border border-slate-200 bg-white" title="Desktop preview" sandbox="" srcDoc={preview} />
              <iframe className="h-48 w-full max-w-sm rounded border border-slate-200 bg-white" title="Mobile preview" sandbox="" srcDoc={preview} />
            </div>
          ) : null}
          <label className="block text-sm text-slate-700">
            Schedule
            <input className={fieldClass} type="datetime-local" value={campaign.scheduledAt} onChange={(event) => setCampaign({ ...campaign, scheduledAt: event.target.value })} />
          </label>
          <p className="text-sm text-slate-600">
            Send now asks the one-minute scheduler to queue eligible contacts. Schedule uses Europe/London wall time, including GMT and BST.
            Placeholders: {"{{firstName}}"}, {"{{lastName}}"}, {"{{email}}"}, {"{{unsubscribeUrl}}"}. A blank first name becomes “there”.
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {campaigns.map((item) => {
              const row = item as { id?: string; name?: string; status?: string; stats?: { acceptedBySmtp?: number; failed?: number; skipped?: number } };
              return (
                <li key={row.id} className="space-y-2 py-3">
                  <p>
                    {row.name} · {row.status} · Accepted by SMTP: {row.stats?.acceptedBySmtp ?? 0}. This is not a delivery receipt.
                    Failed {row.stats?.failed ?? 0}, skipped {row.stats?.skipped ?? 0}. Opens, clicks, bounces and complaints: unavailable.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="underline" onClick={() => void post({ action: "send-now", id: row.id })}>Send now</button>
                    <button type="button" className="underline" onClick={() => {
                      const when = londonWallTimeToUtc(campaign.scheduledAt);
                      if (!when) {
                        setNotice("Enter a real Europe/London time. The missing hour when clocks go forward cannot be scheduled.");
                        return;
                      }
                      void post({ action: "schedule-campaign", id: row.id, scheduledAt: when });
                    }}>Schedule</button>
                    <button type="button" className="underline" onClick={() => void post({ action: "pause-campaign", id: row.id })}>Pause</button>
                    <button type="button" className="underline" onClick={() => void post({ action: "resume-campaign", id: row.id })}>Resume</button>
                    <button type="button" className="underline" onClick={() => {
                      if (window.confirm("Cancel this campaign?")) void post({ action: "cancel-campaign", id: row.id });
                    }}>Cancel</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {campaigns.length === 0 ? <p className="text-sm text-slate-600">No campaigns yet.</p> : null}
          <h3 className="font-display text-xl text-navy-900">Recent activity</h3>
          <ul className="text-sm text-slate-700">
            {activity.slice(0, 10).map((item, index) => {
              const entry = item as { action?: string; at?: string };
              return <li key={`${entry.at}-${index}`}>{entry.at} · {entry.action}</li>;
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
