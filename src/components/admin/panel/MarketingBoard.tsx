"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/admin/FormStatus";
import { fieldClass, labelClass } from "@/components/admin/fields";
import { currentAccessToken } from "@/lib/admin/auth";
import {
  fetchMarketingSettings,
  saveMarketingAllowlist,
  saveMarketingSender,
  saveMarketingSettings,
  sendMarketingTestEmail,
  testMarketingConnection,
  type MarketingOverview,
  type MarketingProblem,
} from "@/lib/admin/marketing-api";

const MESSAGES: Record<string, string> = {
  invalid_body: "The settings request could not be read.",
  invalid_settings: "Enter a mail host, port 465 or 587, a username, and a password of at least 8 characters.",
  invalid_sender: "Enter a sender name and email address. A sender list can hold 20 addresses.",
  invalid_allowlist: "Enter up to 50 valid email addresses, one per line.",
  invalid_recipient: "Enter the email address that should receive the test message, and choose a sender.",
  smtp_unconfigured: "Save the SMTP host, username, and password before sending a test.",
  smtp_failed: "The mail server did not accept the connection.",
  sender_not_found: "That sender is no longer saved.",
  rate_limited: "Too many test messages were sent. Wait 15 minutes and try again.",
  marketing_unavailable: "Marketing settings are not available.",
  unavailable: "The administration service could not save these settings.",
};

function problemMessage(result: MarketingProblem): string {
  if (result.status === "error") return MESSAGES[result.error] ?? MESSAGES.unavailable;
  if (result.status === "unconfigured") return "The administration API is not configured.";
  return MESSAGES.unavailable;
}

export function MarketingBoard({ onUnauthorised }: { onUnauthorised: () => void }) {
  const [overview, setOverview] = useState<MarketingOverview | "loading" | "error">("loading");
  const [host, setHost] = useState("");
  const [port, setPort] = useState<465 | 587>(465);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [allowlistText, setAllowlistText] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [testSenderId, setTestSenderId] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const access = await currentAccessToken();
      if (cancelled) return;
      if (access.status !== "token") {
        onUnauthorised();
        return;
      }
      const result = await fetchMarketingSettings(access.token);
      if (cancelled) return;
      if (result.status === "unauthorized" || result.status === "forbidden") {
        onUnauthorised();
        return;
      }
      if (result.status !== "ok") {
        setOverview("error");
        return;
      }
      applyOverview(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [onUnauthorised]);

  function applyOverview(result: MarketingOverview, keepPassword = false) {
    setOverview(result);
    setHost(result.settings.host ?? "");
    setPort(result.settings.port ?? 465);
    setUsername(result.settings.username ?? "");
    if (!keepPassword) setPassword("");
    setAllowlistText(result.allowlist.emails.join("\n"));
    setTestSenderId((current) =>
      result.senders.some((sender) => sender.id === current) ? current : (result.senders[0]?.id ?? ""),
    );
  }

  async function run(action: (token: string) => Promise<MarketingOverview | MarketingProblem>, success: string) {
    setBusy(true);
    setMessage(null);
    const access = await currentAccessToken();
    if (access.status !== "token") {
      setBusy(false);
      onUnauthorised();
      return false;
    }
    const result = await action(access.token);
    setBusy(false);
    if (result.status === "unauthorized" || result.status === "forbidden") {
      onUnauthorised();
      return false;
    }
    if (result.status !== "ok") {
      setTone("error");
      setMessage(problemMessage(result));
      return false;
    }
    applyOverview(result);
    setTone("success");
    setMessage(success);
    return true;
  }

  function saveSettings(event: FormEvent) {
    event.preventDefault();
    void run(
      (token) =>
        saveMarketingSettings(token, {
          host,
          port,
          username,
          ...(password ? { password } : {}),
        }),
      password ? "SMTP settings saved. The password was replaced." : "SMTP settings saved. The saved password was kept.",
    );
  }

  const loaded = overview !== "loading" && overview !== "error" ? overview : null;
  const campaignBlocked = !loaded || loaded.allowlist.campaignSending === "blocked";

  return (
    <div className="grid max-w-4xl gap-6">
      {overview === "loading" ? <p className="text-sm text-slate-600">Loading marketing settings…</p> : null}
      {overview === "error" ? (
        <p className="text-sm text-slate-600">Marketing settings could not be loaded.</p>
      ) : null}
      <FormStatus message={message} tone={tone} />

      <form onSubmit={saveSettings} className="rounded-lg border border-slate-200 bg-surface p-4">
        <h2 className="font-display text-2xl text-navy-900">SMTP</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          These settings are only for marketing mail. Enquiry notifications keep their own mailbox. A saved
          password is never shown again. Leave the password blank to keep it, or type a new one to replace it.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Host
            <input className={fieldClass} value={host} autoComplete="off" onChange={(event) => setHost(event.target.value)} required />
          </label>
          <label className={labelClass}>
            Port
            <select
              className={fieldClass}
              value={port}
              onChange={(event) => setPort(event.target.value === "587" ? 587 : 465)}
            >
              <option value={465}>465</option>
              <option value={587}>587</option>
            </select>
          </label>
          <label className={labelClass}>
            Username
            <input className={fieldClass} value={username} autoComplete="off" onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label className={labelClass}>
            Password
            <input
              className={fieldClass}
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder={loaded?.settings.passwordSet ? "Saved password stays unless you replace it" : "Required the first time"}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {loaded?.settings.passwordSet ? "A password is saved for this mailbox." : "No marketing password is saved yet."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>Save SMTP settings</Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(
                (token) => testMarketingConnection(token, { host, port, username, ...(password ? { password } : {}) }),
                "The mail server accepted the connection. No message was sent.",
              )
            }
          >
            Test connection
          </Button>
        </div>
      </form>

      <form
        className="rounded-lg border border-slate-200 bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const emails = allowlistText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          void run((token) => saveMarketingAllowlist(token, emails), "Campaign allowlist saved.");
        }}
      >
        <h2 className="font-display text-2xl text-navy-900">Demo campaign allowlist</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This saved list is not marketing consent and it does not choose campaign recipients. Campaigns use
          contacts with a granted consent record, and they skip unsubscribed or suppressed addresses.
          {campaignBlocked
            ? " The list is empty."
            : " Addresses on this list are still not campaign recipients unless they have their own consent record."}{" "}
          Test messages are not campaign sends. They can use any address and are not part of campaign reports.
          SMTP acceptance is not delivery confirmation.
        </p>
        <label className={`${labelClass} mt-4`}>
          One address per line
          <textarea className={`${fieldClass} min-h-28`} value={allowlistText} onChange={(event) => setAllowlistText(event.target.value)} />
        </label>
        <Button type="submit" className="mt-4" disabled={busy}>Save allowlist</Button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-surface p-4">
        <h2 className="font-display text-2xl text-navy-900">Sender identities</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          SMTP accepted means the mail server accepted a test message from that address. It does not prove ownership of
          the address, and it is not SPF, DKIM, or provider verification. A campaign cannot use this status as permission
          to send. Changing the email clears the SMTP accepted status.
        </p>
        {loaded && loaded.senders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No senders saved yet.</p>
        ) : null}
        <ul className="mt-4 space-y-3">
          {loaded?.senders.map((sender) => (
            <li key={sender.id} className="rounded-md border border-slate-200 px-3 py-2">
              {editingId === sender.id ? (
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void (async () => {
                      const saved = await run(
                        (token) => saveMarketingSender(token, { id: sender.id, fromName: editName, fromEmail: editEmail }),
                        "Sender updated. Changing the email clears the SMTP accepted status.",
                      );
                      if (saved) setEditingId(null);
                    })();
                  }}
                >
                  <label className={labelClass}>
                    Sender name
                    <input className={fieldClass} value={editName} onChange={(event) => setEditName(event.target.value)} required />
                  </label>
                  <label className={labelClass}>
                    Sender email
                    <input className={fieldClass} type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required />
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy}>Save sender</Button>
                    <Button type="button" variant="ghost" className="px-3 py-2" disabled={busy} onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{sender.fromName}</p>
                    <p className="text-sm text-slate-600">{sender.fromEmail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">
                      {sender.smtpTestStatus === "smtp-accepted" ? "SMTP accepted" : "Not tested"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-2"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(sender.id);
                        setEditName(sender.fromName);
                        setEditEmail(sender.fromEmail);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-2"
                      disabled={busy}
                      onClick={() => void run((token) => saveMarketingSender(token, { id: sender.id, fromName: sender.fromName, fromEmail: sender.fromEmail, remove: true }), "Sender removed.")}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              const saved = await run(
                (token) => saveMarketingSender(token, { fromName: senderName, fromEmail: senderEmail }),
                "Sender saved. A later test only shows whether the SMTP server accepts a message.",
              );
              if (saved) {
                setSenderName("");
                setSenderEmail("");
              }
            })();
          }}
        >
          <label className={labelClass}>
            Sender name
            <input className={fieldClass} value={senderName} onChange={(event) => setSenderName(event.target.value)} required />
          </label>
          <label className={labelClass}>
            Sender email
            <input className={fieldClass} type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} required />
          </label>
          <Button type="submit" disabled={busy}>Add sender</Button>
        </form>
      </section>

      <form
        className="rounded-lg border border-slate-200 bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            (token) => sendMarketingTestEmail(token, { to: testRecipient, senderId: testSenderId }),
            "Test message accepted. It is stored apart from campaign reporting.",
          );
        }}
      >
        <h2 className="font-display text-2xl text-navy-900">Test email</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A test can go to any address. It uses the saved SMTP password and the chosen sender. It does not use the campaign allowlist.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Sender
            <select className={fieldClass} value={testSenderId} onChange={(event) => setTestSenderId(event.target.value)} required>
              <option value="">Choose a sender</option>
              {loaded?.senders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.fromName} ({sender.fromEmail})
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Recipient
            <input className={fieldClass} type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} required />
          </label>
        </div>
        <Button type="submit" className="mt-4" disabled={busy || !testSenderId}>Send test email</Button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-surface p-4">
        <h2 className="font-display text-2xl text-navy-900">Audit</h2>
        {loaded && loaded.audit.length === 0 ? <p className="mt-3 text-sm text-slate-600">No marketing settings activity yet.</p> : null}
        <ul className="mt-3 space-y-2">
          {loaded?.audit.map((entry) => (
            <li key={`${entry.at}:${entry.action}:${entry.target ?? ""}`} className="text-sm text-slate-600">
              {entry.at} · {entry.action} · {entry.outcome}
              {entry.target ? ` · ${entry.target}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
