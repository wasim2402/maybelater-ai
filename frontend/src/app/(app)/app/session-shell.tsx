"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { APP_NAV, AppShell } from "@/components/app-shell/app-shell";
import type { CaptureInput } from "@/features/capture/capture-schema";
import { useCapture } from "@/features/intentions/api";
import { useReminderAlerts } from "@/features/reminders/use-reminder-alerts";
import { useRecommendations } from "@/features/resurfacing/api";
import { setUnauthenticatedHandler } from "@/lib/api/client";
import type { SessionUser } from "@/lib/auth/server";

const CaptureContext = createContext<{ openCapture: () => void }>({ openCapture: () => {} });

/** Opens the global capture dialog from anywhere inside /app (empty states, headers). */
export function useOpenCapture() {
  return useContext(CaptureContext).openCapture;
}

/** The signed-in frame: global capture, and a redirect to sign in if the API says the session ended. */
export function SessionShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const router = useRouter();
  const capture = useCapture();
  const [captureOpen, setCaptureOpen] = useState(false);
  const recommendations = useRecommendations();
  const resurfacedCount = recommendations.data?.items.length ?? 0;
  const dueCount = useReminderAlerts();
  const nav = useMemo(
    () =>
      APP_NAV.map((n) =>
        n.href === "/app/resurfaced"
          ? { ...n, count: resurfacedCount || undefined }
          : n.href === "/app/reminders"
            ? { ...n, count: dueCount || undefined }
            : n,
      ),
    [resurfacedCount, dueCount],
  );

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?reason=expired&next=${encodeURIComponent(next)}`);
    });
    return () => setUnauthenticatedHandler(null);
  }, [router]);

  const onCapture = useCallback(
    async (input: CaptureInput, requestId: string) => {
      const { result, item } = await capture.mutateAsync({ input, requestId });
      const open = { label: "Open", onClick: () => router.push(`/app/items/${item.id}`) };
      if (result === "duplicate") toast("That link is already in your inbox.", { action: open });
      else toast("Saved to your inbox.", { action: open });
      return result;
    },
    [capture, router],
  );

  const context = useMemo(() => ({ openCapture: () => setCaptureOpen(true) }), []);

  return (
    <CaptureContext.Provider value={context}>
      <AppShell
        account={{ name: user.name, email: user.email }}
        nav={nav}
        onCapture={onCapture}
        captureOpen={captureOpen}
        onCaptureOpenChange={setCaptureOpen}
      >
        {children}
      </AppShell>
    </CaptureContext.Provider>
  );
}
