import { AlertCircle, Archive, CheckCircle2, CircleDot, Inbox, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "cn";

import type { AnalysisState, IntentionStatus } from "./types";

const STATUS: Record<IntentionStatus, { label: string; icon: LucideIcon; className: string }> = {
  inbox: { label: "In inbox", icon: Inbox, className: "bg-grey text-ink" },
  active: { label: "Active", icon: CircleDot, className: "bg-beige text-ink" },
  completed: { label: "Done", icon: CheckCircle2, className: "bg-sage-soft text-sage-deep" },
  archived: { label: "Archived", icon: Archive, className: "bg-grey text-muted-foreground" },
};

const chip = "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-[13px] leading-none font-medium whitespace-nowrap";

/** Status label: always icon + words, so status never relies on colour alone. */
export function StatusLabel({ status, className }: { status: IntentionStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = STATUS[status];
  return (
    <span className={cn(chip, tone, className)}>
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

const ANALYSIS: Partial<Record<AnalysisState, { label: string; icon: LucideIcon; className: string; pulse?: boolean }>> = {
  pending: { label: "Reading it", icon: Sparkles, className: "bg-sage-soft/70 text-sage-deep", pulse: true },
  failed: { label: "No suggestions", icon: AlertCircle, className: "bg-grey text-muted-foreground" },
};

/** Shown only while analysis is running or after it failed; nothing for ready or off. */
export function AnalysisLabel({ state, className }: { state: AnalysisState; className?: string }) {
  const meta = ANALYSIS[state];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className={cn(chip, meta.className, className)}>
      <Icon aria-hidden className={cn("size-3.5", meta.pulse && "animate-pulse")} />
      {meta.label}
    </span>
  );
}

/** Category label: quiet outline chip, user-editable text. */
export function CategoryLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-sm border border-line px-2 text-[13px] leading-none font-medium text-ink whitespace-nowrap", className)}>
      {children}
    </span>
  );
}
