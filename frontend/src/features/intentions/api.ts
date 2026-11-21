"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";

import type { CaptureInput } from "../capture/capture-schema";
import {
  captureResultSchema,
  categorySchema,
  intentionPageSchema,
  intentionSchema,
  type CaptureResult,
  type Intention,
  type IntentionPage,
  type IntentionFilters,
  type IntentionUpdate,
  type SincePreset,
  type SuggestionKey,
  tagCountSchema,
} from "./types";

export const intentionKeys = {
  all: ["intentions"] as const,
  list: (filters: IntentionFilters) => ["intentions", "list", filters] as const,
  detail: (id: string) => ["intentions", "detail", id] as const,
};

/** Start of the "saved within" window, at midnight local time (stable for the whole day). */
export function sinceToDate(since: SincePreset | undefined, now = new Date()): string | undefined {
  if (!since) return undefined;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (since === "7d") start.setDate(start.getDate() - 7);
  else if (since === "30d") start.setDate(start.getDate() - 30);
  else start.setMonth(0, 1);
  // ISO with the local offset, e.g. 2026-11-14T00:00:00+05:30 (the API requires an offset)
  const offset = -start.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const local = new Date(start.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

export function toQuery(filters: IntentionFilters) {
  return {
    status: filters.status,
    q: filters.q?.trim() || undefined,
    category: filters.category || undefined,
    tag: filters.tag || undefined,
    created_after: sinceToDate(filters.since),
  };
}

const PAGE_SIZE = 20;

const POLL_MS = 2_500;

export function useIntentions(filters: IntentionFilters) {
  return useInfiniteQuery({
    // While any visible item is still being read, check again shortly so suggestions appear by themselves.
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.items.some((i) => i.analysis_status === "pending")) ? POLL_MS : false,
    queryKey: intentionKeys.list(filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.get("/intentions", { query: { ...toQuery(filters), limit: PAGE_SIZE, cursor: pageParam }, schema: intentionPageSchema, signal }),
    placeholderData: (previous) => previous, // keep showing results while a new search loads
    getNextPageParam: (last: IntentionPage) => last.next_cursor,
  });
}

export function useIntention(id: string) {
  return useQuery({
    queryKey: intentionKeys.detail(id),
    queryFn: ({ signal }) => api.get(`/intentions/${id}`, { schema: intentionSchema, signal }),
    refetchInterval: (query) => (query.state.data?.analysis_status === "pending" ? POLL_MS : false),
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: ({ signal }) => api.get("/tags", { schema: z.array(tagCountSchema), signal }),
    staleTime: 60_000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post("/categories", { name }, { schema: categorySchema }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => api.get("/categories", { schema: z.array(categorySchema), signal }),
    staleTime: 5 * 60_000,
  });
}

/** Saves a capture. `requestId` identifies the attempt: retrying after a network failure reuses it,
 *  so the server returns the item it already saved instead of storing a second one. */
export function useCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, requestId }: { input: CaptureInput; requestId: string }) =>
      api.post(
        "/captures",
        { content: input.content, note: input.note, client_request_id: requestId },
        { schema: captureResultSchema },
      ),
    onSuccess: (result: CaptureResult) => {
      queryClient.setQueryData(intentionKeys.detail(result.item.id), result.item);
      void queryClient.invalidateQueries({ queryKey: ["intentions", "list"] });
    },
  });
}

function replaceInLists(queryClient: ReturnType<typeof useQueryClient>, item: Intention) {
  queryClient.setQueriesData<InfiniteData<IntentionPage>>({ queryKey: ["intentions", "list"] }, (data) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((i) => (i.id === item.id ? item : i)) })) }
      : data,
  );
}

export function useUpdateIntention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: IntentionUpdate }) =>
      api.patch(`/intentions/${id}`, update, { schema: intentionSchema }),
    onSuccess: (item, { update }) => {
      queryClient.setQueryData(intentionKeys.detail(item.id), (old: Intention | undefined) => ({
        ...item,
        suggestion_confidence: item.suggestion_confidence ?? old?.suggestion_confidence ?? null,
      }));
      replaceInLists(queryClient, item);
      // A status, category or tag change can move the item in or out of the current filters.
      if (update.status || update.category_id !== undefined || update.tags) {
        void queryClient.invalidateQueries({ queryKey: ["intentions", "list"] });
      }
      if (update.tags) void queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useDeleteIntention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/intentions/${id}`),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: intentionKeys.detail(id) });
      queryClient.setQueriesData<InfiniteData<IntentionPage>>({ queryKey: ["intentions", "list"] }, (data) =>
        data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) })) } : data,
      );
    },
  });
}

function useStoreItem() {
  const queryClient = useQueryClient();
  return (item: Intention) => {
    queryClient.setQueryData(intentionKeys.detail(item.id), (old: Intention | undefined) => ({
      ...item,
      suggestion_confidence: item.suggestion_confidence ?? old?.suggestion_confidence ?? null,
    }));
    replaceInLists(queryClient, item);
  };
}

/** Keep or dismiss one AI suggestion. */
export function useDecideSuggestion() {
  const store = useStoreItem();
  return useMutation({
    mutationFn: ({ id, field, action }: { id: string; field: SuggestionKey; action: "accept" | "dismiss" }) =>
      api.post(`/intentions/${id}/suggestions/${field}`, { action }, { schema: intentionSchema }),
    onSuccess: store,
  });
}

/** Ask for suggestions again (after a failure, or for fresh ones). Decided fields are never overwritten. */
export function useAnalyze() {
  const store = useStoreItem();
  return useMutation({
    mutationFn: (id: string) => api.post("/ai/analyze", { intention_id: id }, { schema: intentionSchema }),
    onSuccess: store,
  });
}
