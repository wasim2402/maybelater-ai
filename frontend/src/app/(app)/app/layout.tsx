import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { requireSessionUser } from "@/lib/auth/server";

import { SessionShell } from "./session-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Every /app route: the session is checked on the server before anything renders. */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}

async function SessionGate({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  return <SessionShell user={user}>{children}</SessionShell>;
}

function ShellFallback() {
  return (
    <div role="status" aria-label="Loading your account" className="grid min-h-svh md:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="hidden border-r border-line bg-beige/45 md:block" />
      <div className="space-y-4 px-4 pt-8 sm:px-8 lg:px-12">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full max-w-3xl" />
      </div>
    </div>
  );
}
