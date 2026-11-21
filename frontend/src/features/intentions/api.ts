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
  type IntentionUpdate,
  type StatusFilter,
} from "./types";

export const intentionKeys = {
  all: ["intentions"] as const,
  list: (status: StatusFilter) => ["intentions", "list", status] as const,
  detail: (id: string) => ["intentions", "detail", id] as const,
};

const PAGE_SIZE = 20;

export function useIntentions(status: StatusFilter) {
  return useInfiniteQuery({
    queryKey: intentionKeys.list(status),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.get("/intentions", { query: { status, limit: PAGE_SIZE, cursor: pageParam }, schema: intentionPageSchema, signal }),
    getNextPageParam: (last: IntentionPage) => last.next_cursor,
  });
}

export function useIntention(id: string) {
  return useQuery({
    queryKey: intentionKeys.detail(id),
    queryFn: ({ signal }) => api.get(`/intentions/${id}`, { schema: intentionSchema, signal }),
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
      queryClient.setQueryData(intentionKeys.detail(item.id), item);
      replaceInLists(queryClient, item);
      // A status change moves the item between filter tabs.
      if (update.status) void queryClient.invalidateQueries({ queryKey: ["intentions", "list"] });
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
