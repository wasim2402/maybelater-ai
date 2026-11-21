"use client";

import { BellRing, CalendarClock, CheckCircle2, Link2, NotebookPen } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/account/api";
import { displayTitle } from "@/features/intentions/intention-row";
import { useCancelReminder, useCompleteReminder, useReminders, useSnoozeReminder, type Reminder } from "@/features/reminders/api";
import { PausedNote, SNOOZE_LABELS, SnoozeReminderMenu } from "@/features/reminders/reminder-controls";
import { formatWallTime } from "@/features/reminders/wall-clock";

/** Reminders that have come due (with done / snooze), and the ones still to come. */
export function RemindersList() {
  const due = useReminders("due");
  const upcoming = useReminders("upcoming");
  const me = useMe();
  const userZone = me.data?.timezone;
  const paused = due.data?.delivery_paused ?? false;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl sm:text-4xl">Reminders</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">Only the reminders you set, at the time you chose.</p>

      {paused ? (
        <div className="mt-4">
          <PausedNote />
        </div>
      ) : null}

      <section aria-labelledby="due-h" className="mt-6">
        <h2 id="due-h" className="text-xl">
          Due now
        </h2>
        <div className="mt-3">
          {due.isPending ? (
            <ListSkeleton rows={2} label="Loading reminders" />
          ) : due.isError ? (
            <ErrorState
              title="Reminders did not load"
              action={
                <Button variant="outline" onClick={() => due.refetch()}>
                  Try again
                </Button>
              }
            >
              {due.error.message}
            </ErrorState>
          ) : due.data.items.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Nothing due. Reminders appear here when their time comes.</p>
          ) : (
            <ul className="space-y-3" aria-label="Due reminders">
              {due.data.items.map((r) => (
                <ReminderCard key={r.id} reminder={r} userZone={userZone} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="upcoming-h" className="mt-10">
        <h2 id="upcoming-h" className="text-xl">
          Coming up
        </h2>
        <div className="mt-3">
          {upcoming.isPending ? (
            <ListSkeleton rows={2} label="Loading upcoming reminders" />
          ) : upcoming.isError ? null : upcoming.data.items.length === 0 ? (
            <EmptyState icon={BellRing} title="No reminders set">
              Open an item and choose <strong className="font-medium">Set a reminder</strong>. You pick the exact day and time;
              nothing is set for you.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-card" aria-label="Upcoming reminders">
              {upcoming.data.items.map((r) => (
                <UpcomingRow key={r.id} reminder={r} userZone={userZone} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function ReminderCard({ reminder, userZone }: { reminder: Reminder; userZone?: string }) {
  const complete = useCompleteReminder();
  const snooze = useSnoozeReminder();
  const busy = complete.isPending || snooze.isPending;
  const { item } = reminder;
  const title = displayTitle(item);
  const SourceIcon = item.source_type === "url" ? Link2 : NotebookPen;
  const fail = (e: Error) => toast.error(e.message);

  return (
    <li className="rounded-xl border border-line bg-card p-4 sm:p-5">
      <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-sage-deep">
        <BellRing aria-hidden className="size-3.5" />
        Reminder for {formatWallTime(reminder.local_time, reminder.timezone, userZone)}
      </p>
      <div className="mt-2 flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-beige text-ink">
          <SourceIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-medium tracking-normal break-words">
            <Link href={`/app/items/${item.id}`} className="hover:underline hover:underline-offset-4">
              {title}
            </Link>
          </h3>
          {item.user_note || item.intent ? <p className="mt-0.5 text-[15px] text-ink/85">{item.user_note || item.intent}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button render={<Link href={`/app/items/${item.id}`} />}>Open</Button>
        <SnoozeReminderMenu
          disabled={busy}
          onPick={(preset) =>
            snooze.mutate({ id: reminder.id, preset }, { onSuccess: () => toast(`Snoozed: ${SNOOZE_LABELS[preset]?.toLowerCase()}.`), onError: fail })
          }
        />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => complete.mutate(reminder.id, { onSuccess: () => toast("Reminder done.", { description: title }), onError: fail })}
        >
          <CheckCircle2 aria-hidden /> Done
        </Button>
      </div>
    </li>
  );
}

function UpcomingRow({ reminder, userZone }: { reminder: Reminder; userZone?: string }) {
  const cancel = useCancelReminder();
  const title = displayTitle(reminder.item);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <Link href={`/app/items/${reminder.item.id}`} className="block truncate text-[15px] font-medium hover:underline hover:underline-offset-4">
          {title}
        </Link>
        <p className="text-[13px] text-muted-foreground">
          {reminder.status === "snoozed" ? "Snoozed until " : reminder.status === "draft" ? "Not confirmed · " : ""}
          {formatWallTime(reminder.local_time, reminder.timezone, userZone)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={cancel.isPending}
        aria-label={`Cancel reminder for ${title}`}
        onClick={() => cancel.mutate(reminder.id, { onSuccess: () => toast("Reminder cancelled."), onError: (e) => toast.error(e.message) })}
      >
        Cancel
      </Button>
    </li>
  );
}
