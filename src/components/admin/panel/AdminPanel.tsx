"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fetchEnquirySummary, type EnquirySummary } from "@/lib/admin/api";
import { currentAccessToken } from "@/lib/admin/auth";
import { AggregateBoard } from "./AggregateBoard";
import { EnquiryBoard } from "./EnquiryBoard";
import { NotificationBoard } from "./NotificationBoard";
import { adminSections, overviewCounts, type AdminSectionId } from "./modules";

export type PanelHealth = "loading" | "ok" | "unavailable" | "unconfigured";

export function AdminPanel({
  health,
  onSignOut,
  onRetry,
  onUnauthorised,
}: {
  health: PanelHealth;
  onSignOut: () => Promise<void>;
  onRetry?: () => void;
  onUnauthorised?: () => void;
}) {
  const [section, setSection] = useState<AdminSectionId>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const current = adminSections.find((item) => item.id === section) ?? adminSections[0];

  function choose(id: AdminSectionId) {
    setSection(id);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-background text-navy-900">
      <header className="border-b border-slate-200 bg-surface">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-navy-900 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="admin-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close menu" : "Menu"}
          </button>
          <img
            src="/brand/occasionfun-logo.png"
            alt="OccasionFun Ltd"
            width={903}
            height={198}
            className="brand-lockup-logo"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl text-navy-900">Admin Panel</p>
            <HealthStatus health={health} onRetry={onRetry} />
          </div>
          <Button type="button" variant="ghost" className="shrink-0 px-3 py-2" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
        <nav
          id="admin-navigation"
          aria-label="Admin sections"
          className={`${menuOpen ? "block" : "hidden"} border-b border-slate-200 bg-navy-900 md:block md:min-h-[calc(100vh-4.5rem)] md:border-b-0`}
        >
          <ul className="space-y-1 p-3">
            {adminSections.map((item) => {
              const active = item.id === section;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${
                      active
                        ? "bg-white text-navy-900"
                        : "text-slate-100 hover:bg-white/10"
                    }`}
                    onClick={() => choose(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl text-navy-900">{current.label}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{current.summary}</p>
          <div className="mt-6">
            <SectionBody id={section} health={health} onUnauthorised={onUnauthorised} />
          </div>
        </main>
      </div>
    </div>
  );
}

function HealthStatus({
  health,
  onRetry,
}: {
  health: PanelHealth;
  onRetry?: () => void;
}) {
  if (health === "ok") {
    return <p className="text-sm text-success">Status: ok</p>;
  }
  if (health === "loading") {
    return <p className="text-sm text-slate-600">Checking the administration service…</p>;
  }
  if (health === "unconfigured") {
    return (
      <p className="text-sm text-slate-600">
        The administration API is not configured, so no administration request was sent.
      </p>
    );
  }
  return (
    <p className="text-sm text-slate-600">
      The administration service could not be reached.{" "}
      {onRetry ? (
        <button type="button" className="font-semibold text-accent" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </p>
  );
}

function SectionBody({
  id,
  health,
  onUnauthorised,
}: {
  id: AdminSectionId;
  health: PanelHealth;
  onUnauthorised?: () => void;
}) {
  if (id === "overview") return <Overview health={health} onUnauthorised={onUnauthorised} />;
  if (id === "visitors") return <Visitors />;
  if (id === "aggregate") return <Aggregate health={health} onUnauthorised={onUnauthorised} />;
  if (id === "enquiries") return <Enquiries health={health} onUnauthorised={onUnauthorised} />;
  if (id === "conversations") return <Conversations />;
  if (id === "notifications") return <Notifications health={health} onUnauthorised={onUnauthorised} />;
  if (id === "marketing") return <Marketing />;
  if (id === "knowledge") return <Knowledge />;
  return <Access />;
}

function NotConnected({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-surface px-4 py-5 text-sm leading-6 text-slate-600">
      {children}
    </p>
  );
}

function Overview({
  health,
  onUnauthorised,
}: {
  health: PanelHealth;
  onUnauthorised?: () => void;
}) {
  const [summary, setSummary] = useState<EnquirySummary | "loading" | "idle">(
    health === "ok" ? "loading" : "idle",
  );

  useEffect(() => {
    if (health !== "ok") return;
    let cancelled = false;
    void (async () => {
      const access = await currentAccessToken();
      if (cancelled) return;
      if (access.status !== "token") {
        onUnauthorised?.();
        return;
      }
      const result = await fetchEnquirySummary(access.token);
      if (cancelled) return;
      if (result.status === "unauthorized") {
        onUnauthorised?.();
        return;
      }
      setSummary(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [health, onUnauthorised]);

  const total = summary !== "loading" && summary !== "idle" && summary.status === "ok" ? String(summary.total) : null;
  const pending =
    summary !== "loading" && summary !== "idle" && summary.status === "ok"
      ? String(summary.byNotificationStatus.pending)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCounts.map((item) => {
          const figure =
            item.label === "Total enquiries"
              ? figureFor(health, summary, total)
              : item.label === "Pending notifications"
                ? figureFor(health, summary, pending)
                : "Not connected";
          return (
            <article key={item.label} className="rounded-lg border border-slate-200 bg-surface p-4">
              <h2 className="text-sm font-semibold text-navy-900">{item.label}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-700">{figure}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
            </article>
          );
        })}
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Recent activity</h2>
        <NotConnected>
          Open Enquiries to read saved contact form records. Visitor activity and chatbot conversations are not connected.
        </NotConnected>
      </section>
    </div>
  );
}

function figureFor(
  health: PanelHealth,
  summary: EnquirySummary | "loading" | "idle",
  value: string | null,
) {
  if (health !== "ok") return "Not connected";
  if (summary === "loading" || summary === "idle") return "Loading…";
  if (!value) return "Could not be loaded";
  return value;
}

function Aggregate({
  health,
  onUnauthorised,
}: {
  health: PanelHealth;
  onUnauthorised?: () => void;
}) {
  if (health !== "ok" || !onUnauthorised) {
    return (
      <NotConnected>
        Aggregate counts can be read when the administration API is available. This section does not list individual visitors.
      </NotConnected>
    );
  }
  return <AggregateBoard onUnauthorised={onUnauthorised} />;
}

function Visitors() {
  return (
    <div className="space-y-4">
      <NotConnected>
        No visitor records are available. The public site stores only this browser’s cookie choice, under the name occasionfun-cookie-consent. Optional analytics are not installed, and no referral or activity feed is collected.
      </NotConnected>
      <p className="text-sm leading-6 text-slate-600">
        Essential cookies stay limited to running the site. Optional analytics cookies are not set unless a visitor allows them, and none are loaded today.
      </p>
    </div>
  );
}

function Enquiries({
  health,
  onUnauthorised,
}: {
  health: PanelHealth;
  onUnauthorised?: () => void;
}) {
  if (health !== "ok" || !onUnauthorised) {
    return (
      <NotConnected>
        Enquiry records are stored by the contact form. This panel can list them when the administration API is available.
      </NotConnected>
    );
  }
  return <EnquiryBoard onUnauthorised={onUnauthorised} />;
}

function Conversations() {
  return (
    <NotConnected>
      No chatbot conversations are available. The agreed conversation rule is unchanged: a visitor provides a name, email, and phone before the conversation, and a transcript email is sent only when that conversation ends. That service is not deployed.
    </NotConnected>
  );
}

function Notifications({
  health,
  onUnauthorised,
}: {
  health: PanelHealth;
  onUnauthorised?: () => void;
}) {
  if (health !== "ok" || !onUnauthorised) {
    return (
      <NotConnected>
        Enquiry notification results are stored with each contact form lead. This panel can read them when the administration API is available.
      </NotConnected>
    );
  }
  return <NotificationBoard onUnauthorised={onUnauthorised} />;
}

function Marketing() {
  return (
    <NotConnected>
      Email marketing is not configured. There is no campaign list, recipient snapshot, suppression list, or provider connection for this panel to manage.
    </NotConnected>
  );
}

function Knowledge() {
  return (
    <NotConnected>
      Chatbot knowledge is not configured. There are no entries to draft, approve, or retire, and no chatbot is using a knowledge store.
    </NotConnected>
  );
}

function Access() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-lg border border-slate-200 bg-surface p-4">
        <h2 className="font-display text-2xl">Admin access</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>You are signed in on this device.</li>
          <li>There is one Cognito group, named admin. There is no Super Admin role and no other role.</li>
          <li>Registration does not add that group. Membership is changed in the Cognito console.</li>
          <li>This panel does not read the ID token and does not show a password.</li>
        </ul>
      </article>
      <article className="rounded-lg border border-slate-200 bg-surface p-4">
        <h2 className="font-display text-2xl">Settings and audit</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign-in uses the Cognito user pool configured for this site. Pool settings are not edited here. No administrative audit history is connected.
        </p>
      </article>
    </div>
  );
}
