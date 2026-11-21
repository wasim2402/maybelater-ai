"use client";

import { Archive, CheckCircle2, Inbox, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import { useDeleteIntention, useIntentions, useUpdateIntention } from "@/features/intentions/api";
import { displayTitle, IntentionRow, type IntentionAction } from "@/features/intentions/intention-row";
import type { Intention, IntentionStatus, StatusFilter } from "@/features/intentions/types";

import { useOpenCapture } from "./session-shell";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Done" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
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

export function InboxHome() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = (FILTERS.find((f) => f.value === params.get("status"))?.value ?? "open") as StatusFilter;
  const openCapture = useOpenCapture();

  const list = useIntentions(filter);
  const update = useUpdateIntention();
  const remove = useDeleteIntention();
  const [toDelete, setToDelete] = useState<Intention | null>(null);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  function setFilter(value: StatusFilter) {
    const next = new URLSearchParams(params);
    if (value === "open") next.delete("status");
    else next.set("status", value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl">Inbox</h1>
        <Button onClick={openCapture} className="hidden sm:inline-flex md:hidden">
          <Plus aria-hidden /> Save something
        </Button>
      </div>

      <div role="group" aria-label="Show" className="mt-5 flex gap-1 overflow-x-auto rounded-lg bg-beige/60 p-1 sm:w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "h-10 shrink-0 rounded-md px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              filter === f.value ? "bg-card text-ink shadow-[inset_0_0_0_1px_var(--brand-line)]" : "text-ink/75 hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
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
          <EmptyInbox filter={filter} onCapture={openCapture} />
        ) : (
          <>
            <ul className="space-y-1" aria-label="Saved items">
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

function EmptyInbox({ filter, onCapture }: { filter: StatusFilter; onCapture: () => void }) {
  if (filter === "completed") {
    return (
      <EmptyState icon={CheckCircle2} title="Nothing marked as done yet">
        When you finish something you saved, mark it as done and it moves here.
      </EmptyState>
    );
  }
  if (filter === "archived") {
    return (
      <EmptyState icon={Archive} title="Nothing archived">
        Archive things you no longer need in your inbox. You can bring them back any time.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={Inbox}
      title={filter === "all" ? "Nothing saved yet" : "Your inbox is empty"}
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
