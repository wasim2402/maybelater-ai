"use client";

import { useSyncExternalStore } from "react";

import type { IntentionFilters, SincePreset, StatusFilter } from "./types";

const STATUSES: StatusFilter[] = ["open", "completed", "archived", "all"];
const SINCE: SincePreset[] = ["7d", "30d", "year"];
const STORAGE_KEY = "maybelater:inbox-url";

/** Inbox filters live in the URL (?status=&q=&category=&tag=&since=), so back/forward and reloads keep them. */
export function readFilters(params: URLSearchParams): IntentionFilters {
  const status = params.get("status") as StatusFilter | null;
  const since = params.get("since") as SincePreset | null;
  return {
    status: status && STATUSES.includes(status) ? status : "open",
    q: params.get("q")?.slice(0, 200) || undefined,
    category: params.get("category") || undefined,
    tag: params.get("tag") || undefined,
    since: since && SINCE.includes(since) ? since : undefined,
  };
}

export function writeFilters(filters: IntentionFilters): string {
  const params = new URLSearchParams();
  if (filters.status !== "open") params.set("status", filters.status);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.since) params.set("since", filters.since);
  const query = params.toString();
  return query ? `/app?${query}` : "/app";
}

export function hasRefinements(filters: IntentionFilters): boolean {
  return Boolean(filters.q?.trim() || filters.category || filters.tag || filters.since);
}

/** Remembers the inbox view (search and filters) so "Back to inbox" from an item returns to it. */
export function rememberInboxUrl(url: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, url);
  } catch {
    // storage unavailable (private mode): the back link falls back to /app
  }
}

const noop = () => () => {};

export function useInboxHref(): string {
  return useSyncExternalStore(
    noop,
    () => {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        return saved && saved.startsWith("/app") ? saved : "/app";
      } catch {
        return "/app";
      }
    },
    () => "/app",
  );
}
