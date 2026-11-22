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

export const UNAUTHORISED_ADMIN_MESSAGE =
  "Your account has been created successfully, but you have not yet been authorised to access the Admin Panel. Please contact the administrator.";

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
    return (
      <AuthCard title="Administration">
        <p className="text-sm leading-6 text-slate-600">
          You are signed in. The administration API is not configured, so no
          administration request was sent.
        </p>
        <Button type="button" className="mt-6 w-full" onClick={onSignOut}>
          Sign out
        </Button>
      </AuthCard>
    );
  }

  return <AdminHealth onSignOut={onSignOut} />;
}

function UnauthorisedAccount({
  onSignOut,
}: {
  onSignOut: () => Promise<void>;
}) {
  return (
    <AuthCard title="Account not authorised">
      <p className="text-sm leading-6 text-slate-600">
        {UNAUTHORISED_ADMIN_MESSAGE}
      </p>
      <Button type="button" className="mt-6 w-full" onClick={onSignOut}>
        Sign out
      </Button>
    </AuthCard>
  );
}

function AdminHealth({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const router = useRouter();
  const [state, setState] = useState<
    "loading" | "ok" | "forbidden" | "unavailable"
  >("loading");

  const load = useCallback(async () => {
    setState("loading");
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

  useEffect(() => {
    let cancelled = false;
    load().catch(() => {
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
    <AuthCard title="Administration">
      <p className="text-sm leading-6 text-slate-600">
        {state === "loading"
          ? "Checking the administration service…"
          : state === "ok"
            ? "The administration service is available."
            : "The administration service could not be reached."}
      </p>
      {state === "ok" ? (
        <p className="mt-3 text-sm text-slate-600">Status: ok</p>
      ) : null}
      {state === "unavailable" ? (
        <Button type="button" className="mt-6 w-full" onClick={() => void load()}>
          Try again
        </Button>
      ) : null}
      <Button
        type="button"
        className="mt-6 w-full"
        onClick={onSignOut}
        disabled={state === "loading"}
      >
        Sign out
      </Button>
    </AuthCard>
  );
}
