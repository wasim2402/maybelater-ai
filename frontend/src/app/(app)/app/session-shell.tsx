"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { setUnauthenticatedHandler } from "@/lib/api/client";
import type { SessionUser } from "@/lib/auth/server";

/** The signed-in frame. If the API ever says the session ended, send the user to sign in again. */
export function SessionShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?reason=expired&next=${encodeURIComponent(next)}`);
    });
    return () => setUnauthenticatedHandler(null);
  }, [router]);

  return (
    <AppShell account={{ name: user.name, email: user.email }}>
      {children}
    </AppShell>
  );
}
