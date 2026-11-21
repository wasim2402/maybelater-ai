"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ArchiveRestore, ArrowLeft, CheckCircle2, ExternalLink, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorState, ListSkeleton, SuccessNote } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AiSuggestionPanel } from "@/features/ai/ai-suggestion-panel";
import {
  useAnalyze,
  useCategories,
  useCreateCategory,
  useDecideSuggestion,
  useDeleteIntention,
  useIntention,
  useUpdateIntention,
} from "@/features/intentions/api";
import { useInboxHref } from "@/features/intentions/inbox-url";
import { displayTitle } from "@/features/intentions/intention-row";
import { CategoryLabel, StatusLabel } from "@/features/intentions/labels";
import { suggestedFields } from "@/features/intentions/suggestions";
import type { Intention, IntentionUpdate, SuggestionKey } from "@/features/intentions/types";
import { markViewed, recommendationsKey } from "@/features/resurfacing/api";
import { ItemReminder } from "@/features/reminders/item-reminder";
import { BringBack } from "@/features/resurfacing/bring-back";
import { ApiError } from "@/lib/api/errors";

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const item = useIntention(id);
  const inboxHref = useInboxHref(); // back to the same search and filters

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={inboxHref} className="inline-flex h-11 items-center gap-2 text-[15px] font-medium text-ink/80 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Inbox
      </Link>
      {item.isPending ? (
        <div className="mt-4">
          <ListSkeleton rows={2} label="Loading this item" />
        </div>
      ) : item.isError ? (
        <ErrorState
          className="mt-4"
          title={item.error instanceof ApiError && item.error.code === "not_found" ? "This item no longer exists" : "This item did not load"}
          action={
            item.error instanceof ApiError && item.error.code === "not_found" ? (
              <Button variant="outline" render={<Link href="/app" />}>
                Back to your inbox
              </Button>
            ) : (
              <Button variant="outline" onClick={() => item.refetch()}>
                Try again
              </Button>
            )
          }
        >
          {item.error instanceof ApiError && item.error.code === "not_found" ? "It may have been deleted." : item.error.message}
        </ErrorState>
      ) : (
        <Loaded key={item.data.id} item={item.data} />
      )}
    </div>
  );
}

function Loaded({ item }: { item: Intention }) {
  // Which saved version the details form confirmed. Lives here because the form re-mounts
  // when the item changes on the server (including after its own save).
  const [savedVersion, setSavedVersion] = useState<string | null>(null);

  // Opening an item counts as looking at it again: it leaves Resurfaced if it had come due.
  const queryClient = useQueryClient();
  useEffect(() => {
    void markViewed(item.id).then(() => queryClient.invalidateQueries({ queryKey: recommendationsKey }));
  }, [item.id, queryClient]);
  const router = useRouter();
  const update = useUpdateIntention();
  const remove = useDeleteIntention();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function setStatus(status: Intention["status"], message: string) {
    const previous = item.status;
    update.mutate(
      { id: item.id, update: { status } },
      {
        onSuccess: () =>
          toast(message, { action: { label: "Undo", onClick: () => update.mutate({ id: item.id, update: { status: previous } }) } }),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <article className="mt-2 space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusLabel status={item.status} />
          {item.category ? <CategoryLabel>{item.category.name}</CategoryLabel> : null}
        </div>
        <h1 className="text-3xl leading-tight break-words sm:text-4xl">{displayTitle(item)}</h1>
        <p className="text-[13px] text-muted-foreground">Saved {format(new Date(item.created_at), "EEEE d MMMM yyyy, HH:mm")}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {item.status === "completed" ? (
            <Button variant="outline" onClick={() => setStatus("inbox", "Back in your inbox.")}>
              <RotateCcw aria-hidden /> Not done yet
            </Button>
          ) : (
            <Button onClick={() => setStatus("completed", "Marked as done.")}>
              <CheckCircle2 aria-hidden /> Mark as done
            </Button>
          )}
          {item.status === "archived" ? (
            <Button variant="outline" onClick={() => setStatus("inbox", "Back in your inbox.")}>
              <ArchiveRestore aria-hidden /> Move to inbox
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStatus("archived", "Archived.")}>
              <Archive aria-hidden /> Archive
            </Button>
          )}
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden /> Delete
          </Button>
        </div>
      </header>

      <section aria-labelledby="original-h" className="space-y-2">
        <h2 id="original-h" className="text-[13px] font-medium tracking-normal text-muted-foreground">
          What you saved
        </h2>
        {item.original_url ? (
          <div className="space-y-2 rounded-lg border border-line bg-card p-4">
            <p className="font-mono text-sm break-all">{item.original_url}</p>
            <Button variant="outline" size="sm" render={<a href={item.original_url} target="_blank" rel="noopener noreferrer nofollow" />}>
              <ExternalLink aria-hidden /> Open original
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-card p-4 text-[15px] whitespace-pre-wrap break-words">{item.original_content}</p>
        )}
      </section>

      <ItemReminder itemId={item.id} />

      <BringBack item={item} />

      <Suggestions item={item} />

      {/* Re-mounts when the item changes on the server (suggestions arrived, one was dismissed), so the
          form never shows stale values. */}
      <EditForm
        key={item.updated_at}
        item={item}
        justSaved={savedVersion === item.updated_at}
        onSaved={setSavedVersion}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this item?"
        description={
          <>
            <strong className="font-medium">{displayTitle(item)}</strong> and anything attached to it will be removed for good.
          </>
        }
        confirmLabel="Delete item"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(item.id);
          toast("Item deleted.");
          router.replace("/app");
        }}
      />
    </article>
  );
}

function Suggestions({ item }: { item: Intention }) {
  const decide = useDecideSuggestion();
  const update = useUpdateIntention();
  const analyze = useAnalyze();

  if (item.analysis_status === "off") {
    return (
      <p className="flex items-start gap-2.5 rounded-lg bg-sage-soft/50 px-4 py-3 text-[15px]">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-sage-deep" />
        Suggestions are not switched on yet. Add your own title and reason below.
      </p>
    );
  }

  const fail = (e: Error) => toast.error(e.message);
  const busy = decide.isPending || update.isPending || analyze.isPending;
  const confidence = item.suggestion_confidence;

  return (
    <AiSuggestionPanel
      fields={suggestedFields(item)}
      analysis={item.analysis_status}
      busy={busy}
      lowConfidence={confidence != null && confidence < 0.5}
      onAccept={(field) => decide.mutate({ id: item.id, field: field as SuggestionKey, action: "accept" }, { onError: fail })}
      onDismiss={(field) => decide.mutate({ id: item.id, field: field as SuggestionKey, action: "dismiss" }, { onError: fail })}
      onEdit={(field, value) => update.mutate({ id: item.id, update: { [field]: value } }, { onError: fail })}
      onRetry={() => analyze.mutate(item.id, { onError: fail })}
    />
  );
}

function EditForm({
  item,
  justSaved,
  onSaved,
}: {
  item: Intention;
  justSaved: boolean;
  onSaved: (version: string) => void;
}) {
  const id = useId();
  const update = useUpdateIntention();
  const categories = useCategories();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [title, setTitle] = useState(item.title ?? "");
  const [note, setNote] = useState(item.user_note ?? "");
  const [categoryId, setCategoryId] = useState(item.category?.id ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));

  const changes: IntentionUpdate = {};
  if (title.trim() !== (item.title ?? "")) changes.title = title.trim();
  if (note.trim() !== (item.user_note ?? "")) changes.user_note = note.trim();
  if (categoryId !== (item.category?.id ?? "")) changes.category_id = categoryId || null;
  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (tagList.join(",").toLowerCase() !== item.tags.join(",")) changes.tags = tagList;
  const dirty = Object.keys(changes).length > 0;

  const touch = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
  };

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-4">
      <h2 id={`${id}-h`} className="text-xl">
        Details
      </h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!dirty) return;
          update.mutate({ id: item.id, update: changes }, { onSuccess: (saved) => onSaved(saved.updated_at) });
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={`${id}-title`} className="text-sm font-medium">
            Title
          </label>
          <Input id={`${id}-title`} value={title} maxLength={300} onChange={(e) => touch(setTitle)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Why you saved it
          </label>
          <Textarea id={`${id}-note`} value={note} maxLength={1000} rows={3} onChange={(e) => touch(setNote)(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-category`} className="text-sm font-medium">
              Category
            </label>
            <select
              id={`${id}-category`}
              value={categoryId}
              onChange={(e) => {
                if (e.target.value === "__new__") setCreatingCategory(true);
                else touch(setCategoryId)(e.target.value);
              }}
              className="h-12 w-full rounded-md border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="">No category</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">New category…</option>
            </select>
            <NewCategoryDialog
              open={creatingCategory}
              onOpenChange={setCreatingCategory}
              onCreated={(createdId) => touch(setCategoryId)(createdId)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-tags`} className="text-sm font-medium">
              Tags
            </label>
            <Input
              id={`${id}-tags`}
              value={tags}
              onChange={(e) => touch(setTags)(e.target.value)}
              aria-describedby={`${id}-tags-hint`}
            />
            <p id={`${id}-tags-hint`} className="text-[13px] text-muted-foreground">
              Separate tags with commas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <div aria-live="polite">
            {justSaved && !dirty ? <SuccessNote>Saved.</SuccessNote> : null}
            {update.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {update.error.message}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}

function NewCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const id = useId();
  const create = useCreateCategory();
  const [name, setName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setName("");
          create.reset();
        }
      }}
    >
      <DialogContent className="gap-5 p-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg">New category</DialogTitle>
          <DialogDescription className="text-[15px] text-ink/85">Only you see the categories you create.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate(name, {
              onSuccess: (category) => {
                onCreated(category.id);
                onOpenChange(false);
                setName("");
                toast(`Category "${category.name}" created. Save changes to use it.`);
              },
            });
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              Name
            </label>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              aria-invalid={create.isError ? true : undefined}
              aria-describedby={create.isError ? `${id}-err` : undefined}
            />
            {create.isError ? (
              <p id={`${id}-err`} role="alert" className="text-sm text-destructive">
                {create.error.message}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
