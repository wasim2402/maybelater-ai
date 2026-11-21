"use client";

import { format, parseISO } from "date-fns";
import { BellRing, CheckCircle2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/account/api";

import {
  useCancelReminder,
  useCompleteReminder,
  useCreateReminder,
  useReminders,
  useRescheduleReminder,
  useSnoozeReminder,
  type Reminder,
} from "./api";
import { PausedNote, SNOOZE_LABELS, SnoozeReminderMenu } from "./reminder-controls";
import { ReminderPicker } from "./reminder-picker";
import { formatWallTime } from "./wall-clock";

const OPEN = new Set(["draft", "scheduled", "snoozed"]);

/** The item page's reminder: set one (explicitly confirmed), see when it is, change, snooze,
 *  cancel, or mark it done once it has come due. */
export function ItemReminder({ itemId }: { itemId: string }) {
  const id = useId();
  const me = useMe();
  const reminders = useReminders("all", itemId);
  const create = useCreateReminder();
  const reschedule = useRescheduleReminder();
  const snooze = useSnoozeReminder();
  const complete = useCompleteReminder();
  const cancel = useCancelReminder();
  const [editing, setEditing] = useState(false);
  const fail = (e: Error) => toast.error(e.message);
  const busy = create.isPending || reschedule.isPending || snooze.isPending || complete.isPending || cancel.isPending;

  const userZone = me.data?.timezone;
  const list = reminders.data?.items ?? [];
  const open = list.find((r) => OPEN.has(r.status));
  const due = list.find((r) => r.status === "sent" && !r.completed_at);
  const current = open ?? due;

  const when = (r: Reminder) => formatWallTime(r.local_time, r.timezone, userZone, "EEEE d MMMM 'at' HH:mm");
  const onSnooze = (r: Reminder) => (preset: Parameters<typeof snooze.mutate>[0]["preset"]) =>
    snooze.mutate({ id: r.id, preset }, { onSuccess: () => toast(`Snoozed: ${SNOOZE_LABELS[preset]?.toLowerCase()}.`), onError: fail });

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3 rounded-xl border border-line bg-card p-4 sm:p-5">
      <h2 id={`${id}-h`} className="inline-flex items-center gap-2 text-base font-medium tracking-normal">
        <BellRing aria-hidden className="size-4 text-sage-deep" />
        Reminder
      </h2>

      {reminders.isPending || me.isPending ? (
        <div aria-hidden className="h-10 animate-pulse rounded-md bg-muted" />
      ) : reminders.isError || me.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Reminders did not load. Refresh to try again.
        </p>
      ) : (
        <>
          {reminders.data.delivery_paused && current ? <PausedNote /> : null}

          {editing || !current ? (
            editing || create.isPending ? (
              <ReminderPicker
                timeZone={userZone!}
                initial={current?.local_time}
                busy={busy}
                confirmLabel={current ? "Change reminder" : "Set reminder"}
                onCancel={() => setEditing(false)}
                onConfirm={(whenValue) => {
                  const done = { onSuccess: () => { setEditing(false); toast("Reminder set."); }, onError: fail };
                  if (current) reschedule.mutate({ id: current.id, when: whenValue }, done);
                  else create.mutate({ intentionId: itemId, when: whenValue }, done);
                }}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-[15px] text-ink/85">
                  No reminder. Choose a day and time and it will appear under Reminders when it&apos;s due, even if this tab is closed.
                </p>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Set a reminder
                </Button>
              </div>
            )
          ) : current.status === "sent" ? (
            <div className="space-y-3">
              <p className="text-[15px]">
                <strong className="font-medium">It&apos;s time.</strong> You asked to be reminded on {when(current)}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={busy} onClick={() => complete.mutate(current.id, { onSuccess: () => toast("Reminder done."), onError: fail })}>
                  <CheckCircle2 aria-hidden /> Done
                </Button>
                <SnoozeReminderMenu disabled={busy} onPick={onSnooze(current)} />
                <Button variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
                  Pick another time
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[15px]">
                {current.status === "snoozed" ? "Snoozed until " : "You'll be reminded on "}
                <strong className="font-medium">{when(current)}</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                  Change
                </Button>
                {current.status !== "draft" ? <SnoozeReminderMenu variant="ghost" label="Later" disabled={busy} onPick={onSnooze(current)} /> : null}
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => cancel.mutate(current.id, { onSuccess: () => toast("Reminder cancelled."), onError: fail })}
                >
                  Cancel reminder
                </Button>
              </div>
            </div>
          )}
          {!current && list[0]?.completed_at ? (
            <p className="text-[13px] text-muted-foreground">Last reminder done {format(parseISO(list[0].completed_at), "d MMM")}.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
