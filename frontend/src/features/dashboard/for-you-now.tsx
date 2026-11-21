"use client";

import { ArrowRight, BellRing, Plus, Repeat2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { displayTitle } from "@/features/intentions/intention-row";
import { useReminders } from "@/features/reminders/api";
import { formatWallTime } from "@/features/reminders/wall-clock";
import { useRecommendations } from "@/features/resurfacing/api";

const SHOWN = 3;

/**
 * "Back for you": the dashboard's answer to "what should I look at again?". Real data only: reminders
 * that have come due and items that resurfaced, a few of each, linking to the full pages. Renders
 * nothing while loading or when there is nothing, so a new or caught-up user sees just their inbox.
 */
export function ForYouNow({ userZone }: { userZone?: string }) {
  const due = useReminders("due");
  const recs = useRecommendations();

  if (due.isError || recs.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-[15px]">
        <span>We couldn&apos;t check what&apos;s due. Your items are safe.</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (due.isError) void due.refetch();
            if (recs.isError) void recs.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const reminders = due.data?.items ?? [];
  const resurfaced = recs.data?.items ?? [];
  if (reminders.length === 0 && resurfaced.length === 0) return null;

  return (
    <section aria-labelledby="for-you-h" className="rounded-xl border border-line bg-card p-4 sm:p-5">
      <h2 id="for-you-h" className="text-xl">
        Back for you
      </h2>
      <ul className="mt-3 divide-y divide-line" aria-label="Due reminders and resurfaced items">
        {reminders.slice(0, SHOWN).map((r) => (
          <Row
            key={`r-${r.id}`}
            href={`/app/items/${r.item.id}`}
            icon={<BellRing aria-hidden className="size-4 text-sage-deep" />}
            title={displayTitle(r.item)}
            detail={`Reminder for ${formatWallTime(r.local_time, r.timezone, userZone)}`}
          />
        ))}
        {resurfaced.slice(0, SHOWN).map((rec) => (
          <Row
            key={`s-${rec.item.id}`}
            href={`/app/items/${rec.item.id}`}
            icon={<Repeat2 aria-hidden className="size-4 text-sage-deep" />}
            title={displayTitle(rec.item)}
            detail={rec.reason}
          />
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {reminders.length ? <AllLink href="/app/reminders">All due reminders ({reminders.length})</AllLink> : null}
        {resurfaced.length ? <AllLink href="/app/resurfaced">All resurfaced ({resurfaced.length})</AllLink> : null}
      </div>
    </section>
  );
}

function Row({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <li className="relative flex items-start gap-3 py-2.5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <Link href={href} className="block truncate text-[15px] font-medium outline-none after:absolute after:inset-0 hover:underline hover:underline-offset-4 focus-visible:after:outline-2 focus-visible:after:outline-ring">
          {title}
        </Link>
        <p className="text-[13px] text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

function AllLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center gap-1.5 text-[15px] font-medium text-sage-deep hover:underline hover:underline-offset-4">
      {children} <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

/** The always-visible way to save something: looks like a field, opens the capture dialog. */
export function QuickCapture({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-12 w-full items-center gap-3 rounded-md border border-input bg-card px-4 text-left text-[15px] text-muted-foreground transition-colors hover:border-sage-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-sage-soft text-sage-deep">
        <Plus className="size-4" />
      </span>
      Save a link or a thought…
    </button>
  );
}
