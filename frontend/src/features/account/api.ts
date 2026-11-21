"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";

/** Mirrors backend app/api/routes/me.py (MeResponse). */
export const preferencesSchema = z.object({
  reminders: z.object({
    enabled: z.boolean(),
    quiet_hours: z.object({ start: z.string(), end: z.string() }).nullable(),
  }),
  resurfacing: z.object({
    enabled: z.boolean(),
    frequency: z.enum(["daily", "few_times_week", "weekly"]),
    stale_after_days: z.number().nullable(),
  }),
  reduce_motion: z.boolean(),
});

export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  timezone: z.string(),
  preferences: preferencesSchema,
  created_at: z.string(),
});

export type Me = z.infer<typeof meSchema>;
export type MeUpdate = Partial<Pick<Me, "display_name" | "timezone" | "preferences">>;

export const meKey = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: ({ signal }) => api.get("/me", { schema: meSchema, signal }) });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: MeUpdate) => api.patch("/me", update, { schema: meSchema }),
    onSuccess: (me) => queryClient.setQueryData(meKey, me),
  });
}
