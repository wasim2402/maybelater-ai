"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { displayTitle } from "@/features/intentions/intention-row";
import { playChime } from "@/features/notifications/chime";

import { useReminders } from "./api";

/** Watches due reminders for the signed-in frame: returns how many are due (the nav count) and shows
 *  a toast (with the chime, when `sound` is on) when a new one comes due while the app is open. Delivery itself happens on the server, so
 *  a closed tab misses nothing: the reminder waits under Reminders. */
export function useReminderAlerts(sound = true): number {
  const router = useRouter();
  const due = useReminders("due");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!due.data) return;
    const ids = due.data.items.map((r) => r.id);
    if (seen.current === null) {
      seen.current = new Set(ids); // already due when the app opened: the count shows them
      return;
    }
    let chimed = false;
    for (const reminder of due.data.items) {
      if (seen.current.has(reminder.id)) continue;
      if (sound && !chimed) chimed = playChime(); // once, however many arrive together
      seen.current.add(reminder.id);
      toast(`Reminder: ${displayTitle(reminder.item)}`, {
        duration: 10_000,
        action: { label: "Open", onClick: () => router.push(`/app/items/${reminder.item.id}`) },
      });
    }
  }, [due.data, router, sound]);

  return due.data?.items.length ?? 0;
}
