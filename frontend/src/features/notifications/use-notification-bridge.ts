"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { reminderKeys } from "@/features/reminders/api";

import { unlockAudio } from "./chime";
import { registerServiceWorker } from "./push";

/** Connects the open app to the service worker: a pushed reminder refreshes the reminder list at
 *  once (the alerts hook then shows the toast and plays the chime), and a notification click can
 *  navigate this tab. Also unlocks audio on the first tap or key press so the chime may play. */
export function useNotificationBridge(): void {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void registerServiceWorker();
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type === "maybelater:push") void queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      if (data?.type === "maybelater:open" && typeof data.url === "string" && data.url.startsWith("/")) router.push(data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [queryClient, router]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}
