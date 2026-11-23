"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fetchAdminHealth, isAdminApiConfigured } from "@/lib/admin/api";
import {
  currentAccessToken,
  isAuthConfigured,
  logOut,
  restoreSession,
  type SessionStatus,
} from "@/lib/admin/auth";
import { AuthCard } from "./AuthCard";
import { AdminPanel, type PanelHealth } from "./panel/AdminPanel";

export const UNAUTHORISED_ADMIN_MESSAGE = "Ask Admin to Provide Access";

export const UNAUTHORISED_ADMIN_EXPLANATION =
  "Your account is registered, but an administrator must grant access before you can open the Admin Panel.";

export function AdminGate() {
  const router = useRouter();
  const configured = isAuthConfigured();
  const [session, setSession] = useState<SessionStatus | null>(null);

  const showSession = useCallback(
    (result: SessionStatus) => {
      if (result.status === "signed-out") {
        router.replace("/admin/login/");
        return;
      }
      setSession(result);
    },
    [router],
  );

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    restoreSession().then((result) => {
      if (!cancelled) showSession(result);
    });
    return () => {
      cancelled = true;
    };
  }, [configured, showSession]);

  async function onRetry() {
    setSession(null);
    showSession(await restoreSession());
  }

  async function onSignOut() {
    await logOut();
    router.replace("/admin/login/?signedOut=1");
  }

  if (!configured) {
    return (
      <AuthCard title="Administration">
        <p className="text-sm leading-6 text-slate-600">
          Administrator sign-in is not configured for this environment.
        </p>
      </AuthCard>
    );
  }

  if (!session || session.status === "signed-out") {
    return (
      <AuthCard title="Administration">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </AuthCard>
    );
  }

  if (session.status === "unavailable") {
    return (
      <AuthCard title="Administration">
        <p className="text-sm leading-6 text-slate-600">
          The session could not be checked. Try again.
        </p>
        <Button type="button" className="mt-6 w-full" onClick={onRetry}>
          Try again
        </Button>
      </AuthCard>
    );
  }

  if (!isAdminApiConfigured()) {
    if (session.status === "unapproved") {
      return <UnauthorisedAccount onSignOut={onSignOut} />;
    }
    return <AdminPanel health="unconfigured" onSignOut={onSignOut} />;
  }

  return <AdminHealth onSignOut={onSignOut} />;
}

function UnauthorisedAccount({
  onSignOut,
}: {
  onSignOut: () => Promise<void>;
}) {
  return (
    <AuthCard
      title={UNAUTHORISED_ADMIN_MESSAGE}
      intro={UNAUTHORISED_ADMIN_EXPLANATION}
    >
      <Button type="button" className="w-full" onClick={onSignOut}>
        Sign out
      </Button>
    </AuthCard>
  );
}

function AdminHealth({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const router = useRouter();
  const [state, setState] = useState<PanelHealth | "forbidden">("loading");

  const load = useCallback(async () => {
    const access = await currentAccessToken();
    if (access.status === "signed-out") {
      await logOut();
      router.replace("/admin/login/");
      return;
    }
    if (access.status === "unavailable") {
      setState("unavailable");
      return;
    }
    const health = await fetchAdminHealth(access.token);
    if (health.status === "unauthorized") {
      await logOut();
      router.replace("/admin/login/");
      return;
    }
    if (health.status === "forbidden") {
      setState("forbidden");
      return;
    }
    if (health.status === "ok") {
      setState("ok");
      return;
    }
    setState("unavailable");
  }, [router]);

  const onUnauthorised = useCallback(() => {
    void logOut().then(() => router.replace("/admin/login/"));
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => load())
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (state === "forbidden") {
    return <UnauthorisedAccount onSignOut={onSignOut} />;
  }

  return (
    <AdminPanel
      health={state}
      onSignOut={onSignOut}
      onRetry={state === "unavailable" ? () => void load() : undefined}
      onUnauthorised={onUnauthorised}
    />
  );
}
