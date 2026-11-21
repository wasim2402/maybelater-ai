"use client";

import { format } from "date-fns";
import { CalendarClock, Clock3 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Intention } from "@/features/intentions/types";
import { useNow } from "@/hooks/use-now";

import { useBringBack, useUnsnooze } from "./api";
import { PRESET_LABELS, WhenMenu } from "./when-menu";

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** An ISO time with this browser's offset, from a <input type="datetime-local"> value. */
function withOffset(value: string): string {
  const date = new Date(value);
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${value.length === 16 ? `${value}:00` : value}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

/** "Bring it back": the day this item should come back to the Resurfaced list. In-app only;
 *  notifications are reminders (a separate, explicit choice). */
export function BringBack({ item }: { item: Intention }) {
  const id = useId();
  const bringBack = useBringBack();
  const unsnooze = useUnsnooze();
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState(() => localInputValue(new Date(Date.now() + 24 * 3600_000)));
  const fail = (e: Error) => toast.error(e.message);
  const busy = bringBack.isPending || unsnooze.isPending;
  const closed = item.status === "completed" || item.status === "archived";
  const now = useNow();

  const scheduled = item.resurface_at ? new Date(item.resurface_at) : null;
  const snoozed = now && item.snoozed_until && new Date(item.snoozed_until).getTime() > now ? new Date(item.snoozed_until) : null;

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3 rounded-xl border border-line bg-card p-4 sm:p-5">
      <h2 id={`${id}-h`} className="inline-flex items-center gap-2 text-base font-medium tracking-normal">
        <CalendarClock aria-hidden className="size-4 text-sage-deep" />
        Bring it back
      </h2>
      <p className="text-[15px] text-ink/85" aria-live="polite">
        {closed
          ? "Done and archived items don't come back. Move it to your inbox first."
          : scheduled
            ? `It will come back to Resurfaced on ${format(scheduled, "EEEE d MMMM 'at' HH:mm")}.`
            : "Choose when you want to see this again. It will appear under Resurfaced; nothing is sent to you."}
      </p>
      {snoozed ? (
        <p className="inline-flex flex-wrap items-center gap-2 text-[15px]">
          <Clock3 aria-hidden className="size-4 text-muted-foreground" />
          Snoozed until {format(snoozed, "EEE d MMM, HH:mm")}.
          <Button variant="link" className="h-auto p-0" disabled={busy} onClick={() => unsnooze.mutate(item.id, { onError: fail })}>
            End snooze
          </Button>
        </p>
      ) : null}
      {!closed ? (
        <div className="flex flex-wrap items-center gap-2">
          <WhenMenu
            label={scheduled ? "Change day" : "Choose a day"}
            disabled={busy}
            onPick={(preset) =>
              bringBack.mutate(
                { id: item.id, when: { preset } },
                { onSuccess: () => toast(`It will come back ${PRESET_LABELS[preset].toLowerCase()}.`), onError: fail },
              )
            }
          />
          <Button variant="ghost" disabled={busy} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
            Pick a date and time
          </Button>
          {scheduled ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => bringBack.mutate({ id: item.id, when: { clear: true } }, { onSuccess: () => toast("It won't come back on a set day."), onError: fail })}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
      {picking && !closed ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            bringBack.mutate(
              { id: item.id, when: { at: withOffset(value) } },
              {
                onSuccess: () => {
                  setPicking(false);
                  toast(`It will come back on ${format(new Date(value), "EEE d MMM 'at' HH:mm")}.`);
                },
                onError: fail,
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`${id}-at`} className="text-sm font-medium">
              Date and time
            </label>
            <Input id={`${id}-at`} type="datetime-local" value={value} min={now ? localInputValue(new Date(now)) : undefined} onChange={(e) => setValue(e.target.value)} className="h-11 sm:w-64" />
          </div>
          <Button type="submit" disabled={busy || !value}>
            Set day
          </Button>
        </form>
      ) : null}
    </section>
  );
}
