"use client";

import { addDays, format, parseISO, set } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNow } from "@/hooks/use-now";

import type { ReminderWhen } from "./api";
import { localString, wallClockNow } from "./wall-clock";

interface ReminderPickerProps {
  /** The user's time zone (Settings). Every time here is a time on that clock. */
  timeZone: string;
  /** Starting choice, as a wall-clock string ("2026-11-21T10:00"), when changing a reminder. */
  initial?: string | null;
  /** Called only when the user presses the confirm button: nothing is scheduled on selection alone. */
  onConfirm: (when: ReminderWhen) => void | Promise<void>;
  onCancel?: () => void;
  confirmLabel?: string;
  busy?: boolean;
  className?: string;
}

type Preset = { id: string; label: string; when: Date };

/** Presets on the user's clock: this evening 19:00 (if still ahead), tomorrow 09:00, this weekend
 *  (Saturday 10:00) and next week (Monday 09:00). */
function buildPresets(now: Date): Preset[] {
  const at = (d: Date, hours: number) => set(d, { hours, minutes: 0, seconds: 0, milliseconds: 0 });
  const presets: Preset[] = [];
  const evening = at(now, 19);
  if (evening > now) presets.push({ id: "evening", label: "This evening", when: evening });
  presets.push({ id: "tomorrow", label: "Tomorrow morning", when: at(addDays(now, 1), 9) });
  let saturday = at(addDays(now, (6 - now.getDay() + 7) % 7), 10);
  if (saturday <= now) saturday = addDays(saturday, 7);
  presets.push({ id: "weekend", label: "This weekend", when: saturday });
  presets.push({ id: "week", label: "Next week", when: at(addDays(now, ((8 - now.getDay()) % 7) || 7), 9) });
  return presets;
}

/** Reminder control: quick choices or a day and time, then an explicit confirmation that states the
 *  exact time and clock. Renders only in the browser (it needs the current time). */
export function ReminderPicker(props: ReminderPickerProps) {
  const now = useNow();
  if (!now) return <div aria-hidden className={cn("h-72 animate-pulse rounded-lg bg-muted", props.className)} />;
  return <PickerInner {...props} nowMs={now} />;
}

function PickerInner({ timeZone, initial, onConfirm, onCancel, confirmLabel = "Set reminder", busy, className, nowMs }: ReminderPickerProps & { nowMs: number }) {
  const id = useId();
  const now = useMemo(() => wallClockNow(nowMs, timeZone), [nowMs, timeZone]);
  const presets = useMemo(() => buildPresets(now), [now]);
  const [selected, setSelected] = useState<Date | null>(() => (initial ? parseISO(initial) : null));
  const [time, setTime] = useState(() => (initial ? initial.slice(11, 16) : "09:00"));

  const withTime = (day: Date, value = time) => {
    const [h, m] = value.split(":").map(Number);
    return set(day, { hours: h || 0, minutes: m || 0, seconds: 0, milliseconds: 0 });
  };
  const inPast = selected ? selected <= now : false;

  return (
    <section aria-label="Choose when to be reminded" className={cn("space-y-3", className)}>
      <div role="radiogroup" aria-label="Quick choices" className="grid grid-cols-2 gap-2">
        {presets.map((p) => {
          const active = selected?.getTime() === p.when.getTime();
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setSelected(p.when);
                setTime(format(p.when, "HH:mm"));
              }}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active ? "border-sage-deep bg-sage-soft" : "border-line bg-card hover:bg-beige",
              )}
            >
              <span className="text-[15px] font-medium">{p.label}</span>
              <span className="text-[13px] text-muted-foreground">{format(p.when, "EEE d MMM, HH:mm")}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" className="justify-start bg-card sm:flex-1" />}>
            <CalendarDays aria-hidden />
            {selected ? format(selected, "EEEE d MMMM") : "Pick a day"}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected ?? undefined}
              disabled={{ before: set(now, { hours: 0, minutes: 0 }) }}
              onSelect={(day) => day && setSelected(withTime(day))}
            />
          </PopoverContent>
        </Popover>
        <div className="sm:w-40">
          <label htmlFor={`${id}-time`} className="sr-only">
            Time
          </label>
          <Input
            id={`${id}-time`}
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              if (selected) setSelected(withTime(selected, e.target.value));
            }}
            className="h-11"
          />
        </div>
      </div>

      <p className="text-[15px]" aria-live="polite">
        {!selected ? (
          <span className="text-muted-foreground">Choose a day and time. Times are in {timeZone}.</span>
        ) : inPast ? (
          <span className="text-destructive">Pick a time later than now.</span>
        ) : (
          <>
            You&apos;ll be reminded on <strong className="font-medium">{format(selected, "EEEE d MMMM 'at' HH:mm")}</strong>{" "}
            <span className="text-muted-foreground">({timeZone})</span>. It appears under Reminders in the app.
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => selected && !inPast && onConfirm({ local: localString(selected), timezone: timeZone })}
          disabled={!selected || inPast || busy}
        >
          {busy ? "Saving…" : confirmLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
      </div>
    </section>
  );
}
