"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";

import { deviceLabel, disablePush, enablePush } from "./push";

/** Mirrors backend app/api/routes/notifications.py (PushStatus). */
export const pushStatusSchema = z.object({
  available: z.boolean(),
  public_key: z.string().nullable(),
  devices: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string().nullable(),
      created_at: z.string(),
      last_success_at: z.string().nullable(),
    }),
  ),
});

export type PushStatus = z.infer<typeof pushStatusSchema>;

export const pushStatusKey = ["notifications", "push"] as const;

export function usePushStatus() {
  return useQuery({ queryKey: pushStatusKey, queryFn: ({ signal }) => api.get("/notifications/push", { schema: pushStatusSchema, signal }) });
}

/** "Turn on notifications": browser permission, subscribe, then save the subscription. */
export function useEnablePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicKey: string) => {
      const subscription = await enablePush(publicKey);
      await api.post("/notifications/push/subscriptions", { ...subscription, label: deviceLabel() });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: pushStatusKey }),
  });
}

/** Stops notifications on this browser (unsubscribes here and removes it on the server). */
export async function disablePushOnThisDevice(): Promise<void> {
  const endpoint = await disablePush();
  if (endpoint) await api.post("/notifications/push/unsubscribe", { endpoint }).catch(() => undefined);
}

export function useDisablePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disablePushOnThisDevice,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: pushStatusKey }),
  });
}

export function useRemoveDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/push/subscriptions/${id}`),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: pushStatusKey }),
  });
}

export function useSendTestPush() {
  return useMutation({
    mutationFn: () => api.post("/notifications/push/test", undefined, { schema: z.object({ sent: z.number() }) }),
  });
}
