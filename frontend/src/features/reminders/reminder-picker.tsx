"use client";

import { addDays, format, nextSaturday, set, startOfTomorrow } from "date-fns";
import { BellRing, CalendarDays } from "lucide-react";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ReminderPickerProps {
  /** Current reminder, if one is set. */
  value: Date | null;
  /** Called only when the user presses "Set reminder": nothing is scheduled on selection alone. */
  onConfirm: (when: Date) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  /** Shown so the user knows which clock the reminder follows. Defaults to the browser's zone. */
  timeZone?: string;
  now?: Date;
  className?: string;
}

type Preset = { id: string; label: string; when: Date };

function buildPresets(now: Date): Preset[] {
  const at = (d: Date, hours: number) => set(d, { hours, minutes: 0, seconds: 0, milliseconds: 0 });
  const presets: Preset[] = [];
  const evening = at(now, 19);
  if (evening > now) presets.push({ id: "evening", label: "This evening", when: evening });
  presets.push({ id: "tomorrow", label: "Tomorrow morning", when: at(startOfTomorrow(), 9) });
  presets.push({ id: "weekend", label: "This weekend", when: at(nextSaturday(now), 10) });
  presets.push({ id: "week", label: "In a week", when: at(addDays(now, 7), 9) });
  return presets;
}

const noop = () => () => {};
/** True only in the browser: dates and time zones are read there, never during prerender. */
function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Reminder control: quick presets or a chosen day and time, confirmed explicitly by the user. */
export function ReminderPicker(props: ReminderPickerProps) {
  const isClient = useIsClient();
  if (!isClient) {
    return <div aria-hidden className={cn("h-72 animate-pulse rounded-lg bg-muted", props.className)} />;
  }
  return <ReminderPickerInner {...props} />;
}

function ReminderPickerInner({ value, onConfirm, onClear, timeZone: zoneProp, now: nowProp, className }: ReminderPickerProps) {
  const id = useId();
  const [now] = useState(() => nowProp ?? new Date());
  const [timeZone] = useState(() => zoneProp ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const presets = useMemo(() => buildPresets(now), [now]);
  const [selected, setSelected] = useState<Date | null>(value);
  const [time, setTime] = useState(() => format(value ?? set(now, { hours: 9, minutes: 0 }), "HH:mm"));
  const [busy, setBusy] = useState(false);

  const applyTime = (day: Date) => {
    const [h, m] = time.split(":").map(Number);
    return set(day, { hours: h || 0, minutes: m || 0, seconds: 0, milliseconds: 0 });
  };

  const inPast = selected ? selected <= now : false;

  async function confirm() {
    if (!selected || inPast) return;
    setBusy(true);
    try {
      await onConfirm(selected);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className={cn("space-y-3", className)}>
      <h2 id={`${id}-title`} className="inline-flex items-center gap-2 text-base font-medium tracking-normal">
        <BellRing aria-hidden className="size-4 text-sage-deep" />
        Remind me
      </h2>

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
          <PopoverTrigger
            render={<Button variant="outline" className="justify-start bg-card sm:flex-1" />}
          >
            <CalendarDays aria-hidden />
            {selected ? format(selected, "EEEE d MMMM") : "Pick a day"}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected ?? undefined}
              disabled={{ before: now }}
              onSelect={(day) => day && setSelected(applyTime(day))}
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
              if (selected) {
                const [h, m] = e.target.value.split(":").map(Number);
                setSelected(set(selected, { hours: h || 0, minutes: m || 0 }));
              }
            }}
            className="h-11"
          />
        </div>
      </div>

      {inPast ? <p className="text-sm text-destructive">Pick a time later than now.</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={confirm} disabled={!selected || inPast || busy}>
          {busy ? "Setting…" : "Set reminder"}
        </Button>
        {value && onClear ? (
          <Button variant="ghost" onClick={() => onClear()}>
            Remove reminder
          </Button>
        ) : null}
        {timeZone ? <span className="text-[13px] text-muted-foreground">Times in {timeZone}</span> : null}
      </div>
    </section>
  );
}
