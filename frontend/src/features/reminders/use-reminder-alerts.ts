"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { displayTitle } from "@/features/intentions/intention-row";

import { useReminders } from "./api";

/** Watches due reminders for the signed-in frame: returns how many are due (the nav count) and shows
 *  a toast when a new one comes due while the app is open. Delivery itself happens on the server, so
 *  a closed tab misses nothing: the reminder waits under Reminders. */
export function useReminderAlerts(): number {
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
    for (const reminder of due.data.items) {
      if (seen.current.has(reminder.id)) continue;
      seen.current.add(reminder.id);
      toast(`Reminder: ${displayTitle(reminder.item)}`, {
        duration: 10_000,
        action: { label: "Open", onClick: () => router.push(`/app/items/${reminder.item.id}`) },
      });
    }
  }, [due.data, router]);

  return due.data?.items.length ?? 0;
}
