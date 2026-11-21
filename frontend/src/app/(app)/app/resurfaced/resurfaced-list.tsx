"use client";

import { CalendarCheck, CheckCircle2, Clock3, History, Link2, NotebookPen, Repeat2, Sparkles, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import { useUpdateIntention } from "@/features/intentions/api";
import { displayTitle, hostOf } from "@/features/intentions/intention-row";
import { CategoryLabel } from "@/features/intentions/labels";
import type { Recommendation } from "@/features/intentions/types";
import { useDismiss, useRecommendations, useSnooze } from "@/features/resurfacing/api";
import { PRESET_LABELS, WhenMenu } from "@/features/resurfacing/when-menu";

const SIGNAL_ICON: Record<Recommendation["signal"], LucideIcon> = {
  date: CalendarCheck,
  snooze: Clock3,
  condition: Sparkles,
  stale: History,
};

/** Items worth another look now, each with the reason it came back and quiet ways to act on it. */
export function ResurfacedList() {
  const recs = useRecommendations();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl sm:text-4xl">Resurfaced</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">Things you asked to see again, back at the moment you chose.</p>

      <div className="mt-6">
        {recs.isPending ? (
          <ListSkeleton rows={3} label="Loading resurfaced items" />
        ) : recs.isError ? (
          <ErrorState
            title="Resurfaced items did not load"
            action={
              <Button variant="outline" onClick={() => recs.refetch()}>
                Try again
              </Button>
            }
          >
            {recs.error.message}
          </ErrorState>
        ) : recs.data.items.length === 0 ? (
          <EmptyState icon={Repeat2} title="Nothing to look at again right now">
            Open an item and choose <strong className="font-medium">Bring it back</strong> to pick a day, or snooze something
            from here. It will show up on this page when the time comes.
          </EmptyState>
        ) : (
          <ul className="space-y-3" aria-label="Resurfaced items">
            {recs.data.items.map((rec) => (
              <ResurfacedCard key={rec.item.id} rec={rec} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResurfacedCard({ rec }: { rec: Recommendation }) {
  const { item } = rec;
  const snooze = useSnooze();
  const dismiss = useDismiss();
  const update = useUpdateIntention();
  const busy = snooze.isPending || dismiss.isPending || update.isPending;
  const SignalIcon = SIGNAL_ICON[rec.signal];
  const SourceIcon = item.source_type === "url" ? Link2 : NotebookPen;
  const title = displayTitle(item);
  const fail = (e: Error) => toast.error(e.message);

  return (
    <li className="rounded-xl border border-line bg-card p-4 sm:p-5">
      <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-sage-deep">
        <SignalIcon aria-hidden className="size-3.5" />
        {rec.reason}
      </p>
      <div className="mt-2 flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-beige text-ink">
          <SourceIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-medium tracking-normal break-words">
            <Link href={`/app/items/${item.id}`} className="hover:underline hover:underline-offset-4">
              {title}
            </Link>
          </h2>
          {item.user_note || item.intent ? <p className="mt-0.5 text-[15px] text-ink/85">{item.user_note || item.intent}</p> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.category ? <CategoryLabel>{item.category.name}</CategoryLabel> : null}
            {hostOf(item.original_url) ? <span className="text-[13px] text-muted-foreground">{hostOf(item.original_url)}</span> : null}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button render={<Link href={`/app/items/${item.id}`} />}>Open</Button>
        <WhenMenu
          label="Snooze"
          icon={<Clock3 aria-hidden />}
          disabled={busy}
          onPick={(preset) =>
            snooze.mutate(
              { id: item.id, when: { preset } },
              { onSuccess: () => toast(`Snoozed until ${PRESET_LABELS[preset].toLowerCase()}.`), onError: fail },
            )
          }
        />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => dismiss.mutate(item.id, { onSuccess: () => toast("Okay, not now.", { description: title }), onError: fail })}
        >
          <X aria-hidden /> Not now
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            update.mutate(
              { id: item.id, update: { status: "completed" } },
              {
                onSuccess: () =>
                  toast("Marked as done.", {
                    description: title,
                    action: { label: "Undo", onClick: () => update.mutate({ id: item.id, update: { status: item.status } }) },
                  }),
                onError: fail,
              },
            )
          }
        >
          <CheckCircle2 aria-hidden /> Done
        </Button>
      </div>
    </li>
  );
}
