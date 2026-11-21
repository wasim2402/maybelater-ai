"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { intentionKeys } from "@/features/intentions/api";
import { intentionSchema, recommendationListSchema, type Intention, type WhenPreset } from "@/features/intentions/types";
import { api } from "@/lib/api/client";

export const recommendationsKey = ["recommendations"] as const;

/** Items worth another look now (deterministic rules on the server). Refreshes every few minutes
 *  and when the window regains focus, since "now" moves on. */
export function useRecommendations() {
  return useQuery({
    queryKey: recommendationsKey,
    queryFn: ({ signal }) => api.get("/recommendations", { schema: recommendationListSchema, signal }),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

export type When = { preset: WhenPreset } | { at: string };

function useItemAction<V>(fn: (vars: V) => Promise<Intention>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (item) => {
      queryClient.setQueryData(intentionKeys.detail(item.id), (old: Intention | undefined) => ({
        ...item,
        suggestion_confidence: old?.suggestion_confidence ?? null,
      }));
      void queryClient.invalidateQueries({ queryKey: recommendationsKey });
      void queryClient.invalidateQueries({ queryKey: ["intentions", "list"] });
    },
  });
}

export function useSnooze() {
  return useItemAction(({ id, when }: { id: string; when: When }) =>
    api.post(`/intentions/${id}/snooze`, when, { schema: intentionSchema }),
  );
}

export function useUnsnooze() {
  return useItemAction((id: string) => api.delete(`/intentions/${id}/snooze`, { schema: intentionSchema }));
}

export function useDismiss() {
  return useItemAction((id: string) => api.post(`/intentions/${id}/dismiss`, undefined, { schema: intentionSchema }));
}

/** Set (or clear) the date to see this again. */
export function useBringBack() {
  return useItemAction(({ id, when }: { id: string; when: When | { clear: true } }) =>
    api.post(`/intentions/${id}/resurface`, when, { schema: intentionSchema }),
  );
}

/** Tells the server the item was opened (clears it from resurfacing if it had come due). */
export function markViewed(id: string) {
  return api.post(`/intentions/${id}/viewed`).catch(() => undefined); // best effort, never blocks the page
}
