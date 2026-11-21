"use client";

import { BellOff, ChevronDown, Clock3 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import type { ReminderPreset } from "./api";

export const SNOOZE_LABELS: Partial<Record<ReminderPreset, string>> = {
  in_an_hour: "In an hour",
  tomorrow: "Tomorrow morning",
  weekend: "This weekend",
  next_week: "Next week",
};

/** "Remind me later": presets the server resolves on the user's clock. */
export function SnoozeReminderMenu({
  onPick,
  disabled,
  variant = "outline",
  label = "Snooze",
}: {
  onPick: (preset: ReminderPreset) => void;
  disabled?: boolean;
  variant?: "outline" | "ghost";
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={variant} disabled={disabled} />}>
        <Clock3 aria-hidden />
        {label}
        <ChevronDown aria-hidden className="size-4 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {(Object.keys(SNOOZE_LABELS) as ReminderPreset[]).map((preset) => (
          <DropdownMenuItem key={preset} onClick={() => onPick(preset)}>
            {SNOOZE_LABELS[preset]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shown wherever reminders appear while the user has turned them off in Settings. */
export function PausedNote() {
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg border border-line bg-beige/60 px-3 py-2.5 text-[15px]">
      <BellOff aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>
        Reminders are turned off, so none will be shown until you turn them back on in{" "}
        <Link href="/app/settings" className="font-medium underline underline-offset-4">
          Settings
        </Link>
        .
      </span>
    </p>
  );
}
