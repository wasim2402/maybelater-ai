"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { intentionSchema } from "@/features/intentions/types";
import { api } from "@/lib/api/client";

/** Mirrors backend app/api/routes/reminders.py (ReminderOut, ReminderList). */
export const reminderSchema = z.object({
  id: z.string().uuid(),
  intention_id: z.string().uuid(),
  status: z.enum(["draft", "scheduled", "snoozed", "sent", "cancelled"]),
  scheduled_at: z.string(),
  timezone: z.string(),
  /** The time on the clock it was set in, e.g. "2026-11-21T10:00". */
  local_time: z.string(),
  approved_at: z.string().nullable(),
  sent_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  delivery_channel: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  item: intentionSchema,
});

export const reminderListSchema = z.object({
  items: z.array(reminderSchema),
  delivery_paused: z.boolean(),
});

export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderState = "due" | "upcoming" | "history" | "all";
export type ReminderPreset = "in_an_hour" | "this_evening" | "tomorrow" | "weekend" | "next_week";

/** A preset, or a wall-clock time ("2026-11-21T10:00") in `timezone` (the server resolves it). */
export type ReminderWhen = { preset: ReminderPreset; timezone?: string } | { local: string; timezone: string };

export const reminderKeys = {
  all: ["reminders"] as const,
  list: (state: ReminderState, intentionId?: string) => ["reminders", state, intentionId ?? null] as const,
};

/** Reminders by state. Delivery happens on the server; this only shows it, so it refreshes every
 *  minute and when the window regains focus. */
export function useReminders(state: ReminderState, intentionId?: string) {
  return useQuery({
    queryKey: reminderKeys.list(state, intentionId),
    queryFn: ({ signal }) =>
      api.get("/reminders", {
        schema: reminderListSchema,
        signal,
        query: { state, ...(intentionId ? { intention_id: intentionId } : {}) },
      }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

function useReminderMutation<V>(fn: (vars: V) => Promise<Reminder>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

/** Only called when the user presses "Set reminder" after seeing the exact time. */
export function useCreateReminder() {
  return useReminderMutation(({ intentionId, when }: { intentionId: string; when: ReminderWhen }) =>
    api.post("/reminders", { intention_id: intentionId, confirm: true, ...when }, { schema: reminderSchema }),
  );
}

export function useRescheduleReminder() {
  return useReminderMutation(({ id, when }: { id: string; when: ReminderWhen }) =>
    api.patch(`/reminders/${id}`, { action: "reschedule", ...when }, { schema: reminderSchema }),
  );
}

export function useSnoozeReminder() {
  return useReminderMutation(({ id, preset }: { id: string; preset: ReminderPreset }) =>
    api.patch(`/reminders/${id}`, { action: "snooze", preset }, { schema: reminderSchema }),
  );
}

export function useCompleteReminder() {
  return useReminderMutation((id: string) => api.patch(`/reminders/${id}`, { action: "complete" }, { schema: reminderSchema }));
}

export function useCancelReminder() {
  return useReminderMutation((id: string) => api.delete(`/reminders/${id}`, { schema: reminderSchema }));
}
