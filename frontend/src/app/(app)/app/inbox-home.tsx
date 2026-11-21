"use client";

import { Archive, CheckCircle2, Inbox, Plus, Search, SearchX, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/features/account/api";
import { ForYouNow, QuickCapture } from "@/features/dashboard/for-you-now";
import { useCategories, useDeleteIntention, useIntentions, useTags, useUpdateIntention } from "@/features/intentions/api";
import { hasRefinements, readFilters, rememberInboxUrl, writeFilters } from "@/features/intentions/inbox-url";
import { displayTitle, IntentionRow, type IntentionAction } from "@/features/intentions/intention-row";
import type { Intention, IntentionFilters, IntentionStatus, SincePreset, StatusFilter } from "@/features/intentions/types";

import { useOpenCapture } from "./session-shell";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Done" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const SINCE_OPTIONS: { value: SincePreset | ""; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "year", label: "This year" },
];

const NEXT_STATUS: Record<Exclude<IntentionAction, "delete">, IntentionStatus> = {
  complete: "completed",
  reopen: "inbox",
  archive: "archived",
  restore: "inbox",
};

const DONE_MESSAGE: Record<Exclude<IntentionAction, "delete">, string> = {
  complete: "Marked as done.",
  reopen: "Back in your inbox.",
  archive: "Archived.",
  restore: "Back in your inbox.",
};

const SEARCH_DELAY_MS = 300;

const selectClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:outline-2 focus-visible:outline-ring sm:w-auto";

export function InboxHome() {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const filters = readFilters(new URLSearchParams(params.toString()));
  const openCapture = useOpenCapture();
  const me = useMe();

  const list = useIntentions(filters);
  const categories = useCategories();
  const tags = useTags();
  const update = useUpdateIntention();
  const remove = useDeleteIntention();
  const [toDelete, setToDelete] = useState<Intention | null>(null);

  // The filters most recently asked for. router.replace() updates the URL asynchronously, so two
  // quick changes (clear the tag, then pick a category) must build on this, not on the last render,
  // or the second change would bring the first one back.
  const latest = useRef<IntentionFilters>(filters);
  const currentUrl = writeFilters(filters);
  useEffect(() => {
    latest.current = readFilters(new URL(currentUrl, "http://local").searchParams);
    rememberInboxUrl(currentUrl);
  }, [currentUrl]);

  function navigate(next: IntentionFilters) {
    latest.current = next;
    router.replace(writeFilters(next), { scroll: false });
  }

  // The search box types freely; the URL (and so the query) follows 300 ms after typing stops.
  const [text, setText] = useState(filters.q ?? "");
  const urlQ = filters.q ?? "";
  useEffect(() => {
    if (text.trim() === urlQ) return;
    const timer = setTimeout(() => {
      navigate({ ...latest.current, q: text });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only typing should schedule a search
  }, [text]);

  function apply(next: Partial<IntentionFilters>) {
    navigate({ ...latest.current, q: text, ...next });
  }

  function clearAll() {
    setText("");
    navigate({ status: latest.current.status });
  }

  function act(action: IntentionAction, item: Intention) {
    if (action === "delete") return setToDelete(item);
    const previous = item.status;
    update.mutate(
      { id: item.id, update: { status: NEXT_STATUS[action] } },
      {
        onSuccess: () =>
          toast(DONE_MESSAGE[action], {
            description: displayTitle(item),
            action: { label: "Undo", onClick: () => update.mutate({ id: item.id, update: { status: previous } }) },
          }),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const refined = hasRefinements(filters);
  const searching = list.isFetching && !list.isFetchingNextPage && !list.isPending;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl sm:text-4xl">Inbox</h1>

      <div className="mt-5">
        <QuickCapture onOpen={openCapture} />
      </div>

      {filters.status === "open" && !refined ? (
        <div className="mt-5">
          <ForYouNow userZone={me.data?.timezone} />
        </div>
      ) : null}

      <div role="search" className="mt-5 space-y-3" aria-label="Search and filter saved items">
        <div className="relative">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search saved items
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${id}-q`}
            type="search"
            value={text}
            maxLength={200}
            placeholder="Search titles, notes and links"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && text) {
                e.preventDefault();
                setText("");
              }
            }}
            className="h-12 pr-10 pl-10"
          />
          {text ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setText("")}
              className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-beige hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div role="group" aria-label="Status" className="flex gap-1 overflow-x-auto rounded-lg bg-beige/60 p-1">
            {STATUS_TABS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filters.status === f.value}
                onClick={() => apply({ status: f.value })}
                className={cn(
                  "h-9 shrink-0 rounded-md px-3.5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  filters.status === f.value ? "bg-card text-ink shadow-[inset_0_0_0_1px_var(--brand-line)]" : "text-ink/75 hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label htmlFor={`${id}-category`} className="sr-only">
            Category
          </label>
          <select id={`${id}-category`} value={filters.category ?? ""} onChange={(e) => apply({ category: e.target.value || undefined })} className={selectClass}>
            <option value="">All categories</option>
            <option value="none">No category</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label htmlFor={`${id}-tag`} className="sr-only">
            Tag
          </label>
          <select id={`${id}-tag`} value={filters.tag ?? ""} onChange={(e) => apply({ tag: e.target.value || undefined })} className={selectClass}>
            <option value="">All tags</option>
            {filters.tag && !(tags.data ?? []).some((t) => t.tag === filters.tag) ? <option value={filters.tag}>{filters.tag}</option> : null}
            {(tags.data ?? []).map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag} ({t.count})
              </option>
            ))}
          </select>

          <label htmlFor={`${id}-since`} className="sr-only">
            Saved
          </label>
          <select id={`${id}-since`} value={filters.since ?? ""} onChange={(e) => apply({ since: (e.target.value || undefined) as SincePreset | undefined })} className={selectClass}>
            {SINCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {refined ? (
            <Button variant="ghost" size="sm" className="h-11 self-start" onClick={clearAll}>
              <X aria-hidden /> Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4" aria-busy={searching}>
        <p role="status" aria-live="polite" className="sr-only">
          {list.isPending ? "Loading" : searching ? "Searching" : `${items.length}${list.hasNextPage ? " or more" : ""} items shown`}
        </p>
        {list.isPending ? (
          <ListSkeleton rows={4} />
        ) : list.isError ? (
          <ErrorState
            title="Your inbox did not load"
            action={
              <Button variant="outline" onClick={() => list.refetch()}>
                Try again
              </Button>
            }
          >
            Your saved items are safe. {list.error.message}
          </ErrorState>
        ) : items.length === 0 ? (
          refined ? (
            <EmptyState
              icon={SearchX}
              title={filters.q ? `Nothing matches “${filters.q}”` : "Nothing matches these filters"}
              action={
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            >
              Try fewer words, the start of a word, or another status.
            </EmptyState>
          ) : (
            <EmptyInbox status={filters.status} onCapture={openCapture} />
          )
        ) : (
          <>
            {filters.status === "open" && !refined ? (
              <h2 className="mb-1 px-1 text-xl" id={`${id}-recent`}>
                Recently saved
              </h2>
            ) : null}
            <ul className={cn("space-y-1 transition-opacity", searching && "opacity-60")} aria-label="Saved items">
              {items.map((item) => (
                <IntentionRow key={item.id} item={item} href={`/app/items/${item.id}`} onAction={act} />
              ))}
            </ul>
            {list.hasNextPage ? (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                  {list.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this item?"
        description={
          <>
            <strong className="font-medium">{toDelete ? displayTitle(toDelete) : ""}</strong> and anything attached to it
            will be removed for good.
          </>
        }
        confirmLabel="Delete item"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          await remove.mutateAsync(toDelete.id);
          toast("Item deleted.");
        }}
      />
    </div>
  );
}

function EmptyInbox({ status, onCapture }: { status: StatusFilter; onCapture: () => void }) {
  if (status === "completed") {
    return (
      <EmptyState icon={CheckCircle2} title="Nothing marked as done yet">
        When you finish something you saved, mark it as done and it moves here.
      </EmptyState>
    );
  }
  if (status === "archived") {
    return (
      <EmptyState icon={Archive} title="Nothing archived">
        Archive things you no longer need in your inbox. You can bring them back any time.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={Inbox}
      title={status === "all" ? "Nothing saved yet" : "Your inbox is empty"}
      action={
        <Button onClick={onCapture}>
          <Plus aria-hidden /> Save your first link or thought
        </Button>
      }
    >
      Paste a link or write a thought. MaybeLater keeps the original exactly as you saved it.
    </EmptyState>
  );
}
