import {
  Archive,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

import type { IntentionStatus } from "./types";

const STATUS: Record<IntentionStatus, { label: string; icon: LucideIcon; className: string }> = {
  inbox: { label: "In inbox", icon: Inbox, className: "bg-grey text-ink" },
  scheduled: { label: "Reminder set", icon: CalendarClock, className: "bg-beige text-ink" },
  resurfaced: { label: "Back for you", icon: BellRing, className: "bg-sage text-on-sage" },
  snoozed: { label: "Snoozed", icon: Clock3, className: "bg-grey text-muted-foreground" },
  completed: { label: "Done", icon: CheckCircle2, className: "bg-sage-soft text-sage-deep" },
  archived: { label: "Archived", icon: Archive, className: "bg-grey text-muted-foreground" },
};

/** Status label: always icon + words, so status never relies on colour alone. */
export function StatusLabel({ status, className }: { status: IntentionStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-[13px] leading-none font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

/** Category label: quiet outline chip, user-editable text. */
export function CategoryLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm border border-line px-2 text-[13px] leading-none font-medium text-ink whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
