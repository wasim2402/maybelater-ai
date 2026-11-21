"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { WhenPreset } from "@/features/intentions/types";

export const PRESET_LABELS: Record<WhenPreset, string> = {
  tomorrow: "Tomorrow morning",
  weekend: "This weekend",
  next_week: "Next week",
  in_a_month: "In a month",
};

/** A small menu of "when" presets. The server resolves them in the user's time zone. */
export function WhenMenu({
  label,
  icon,
  onPick,
  disabled,
  variant = "outline",
}: {
  label: string;
  icon?: React.ReactNode;
  onPick: (preset: WhenPreset) => void;
  disabled?: boolean;
  variant?: "outline" | "ghost" | "default";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={variant} disabled={disabled} />}>
        {icon}
        {label}
        <ChevronDown aria-hidden className="size-4 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {(Object.keys(PRESET_LABELS) as WhenPreset[]).map((preset) => (
          <DropdownMenuItem key={preset} onClick={() => onPick(preset)}>
            {PRESET_LABELS[preset]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
