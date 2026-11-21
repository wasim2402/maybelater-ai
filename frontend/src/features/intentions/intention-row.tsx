"use client";

import { format } from "date-fns";
import {
  Archive,
  BellRing,
  CheckCircle2,
  Clock3,
  Link2,
  MoreHorizontal,
  NotebookPen,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { CategoryLabel, StatusLabel } from "./labels";
import type { Intention } from "./types";

export type IntentionAction = "complete" | "snooze" | "archive" | "delete";

interface IntentionRowProps {
  item: Intention;
  href?: string;
  onAction?: (action: IntentionAction, item: Intention) => void;
  className?: string;
}

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** One saved item in a list: what it is, why it was saved, its state, and its actions. */
export function IntentionRow({ item, href, onAction, className }: IntentionRowProps) {
  const SourceIcon = item.sourceType === "url" ? Link2 : NotebookPen;
  const host = hostOf(item.url);
  const done = item.status === "completed" || item.status === "archived";

  return (
    <li
      className={cn(
        "group/row relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-lg border border-transparent px-3 py-3.5 transition-colors hover:border-line hover:bg-card sm:gap-x-4 sm:px-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-beige text-ink"
      >
        <SourceIcon className="size-4" />
      </span>

      <div className="min-w-0">
        <h3 className={cn("text-base leading-snug font-medium tracking-normal", done && "text-muted-foreground line-through decoration-1")}>
          {href ? (
            <a href={href} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h3>
        {item.reason ? (
          <p className="mt-0.5 line-clamp-2 text-[15px] leading-normal text-ink/85">{item.reason}</p>
        ) : item.analysis === "pending" ? (
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Sparkles aria-hidden className="size-3.5 animate-pulse text-sage-deep" />
            Working out why you saved this
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusLabel status={item.status} />
          {item.category ? <CategoryLabel>{item.category}</CategoryLabel> : null}
          {item.remindAt ? (
            <span className="inline-flex h-6 items-center gap-1 text-[13px] text-muted-foreground">
              <BellRing aria-hidden className="size-3.5" />
              {format(new Date(item.remindAt), "EEE d MMM, HH:mm")}
            </span>
          ) : null}
          {host ? <span className="truncate text-[13px] text-muted-foreground">{host}</span> : null}
        </div>
      </div>

      {onAction ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${item.title}`}
            className="relative z-10 -mr-1 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-beige hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onAction("complete", item)}>
              <CheckCircle2 aria-hidden /> Mark as done
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("snooze", item)}>
              <Clock3 aria-hidden /> Snooze
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("archive", item)}>
              <Archive aria-hidden /> Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onAction("delete", item)}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span />
      )}
    </li>
  );
}
