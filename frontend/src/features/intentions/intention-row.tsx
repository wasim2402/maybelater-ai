"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import { Archive, ArchiveRestore, CalendarClock, CheckCircle2, Clock3, Link2, MoreHorizontal, NotebookPen, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { AnalysisLabel, CategoryLabel, StatusLabel } from "./labels";
import { useNow } from "@/hooks/use-now";

import type { Intention } from "./types";

export type IntentionAction = "complete" | "reopen" | "archive" | "restore" | "delete";

interface IntentionRowProps {
  item: Intention;
  href?: string;
  onAction?: (action: IntentionAction, item: Intention) => void;
  className?: string;
}

export function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function displayTitle(item: Intention) {
  return item.title || hostOf(item.original_url) || item.original_content.slice(0, 80);
}

/** One saved item in a list: what it is, why it was saved, its state, and its actions. */
export function IntentionRow({ item, href, onAction, className }: IntentionRowProps) {
  const SourceIcon = item.source_type === "url" ? Link2 : NotebookPen;
  const host = hostOf(item.original_url);
  const closed = item.status === "completed" || item.status === "archived";
  const title = displayTitle(item);
  const saved = formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true });

  return (
    <li
      className={cn(
        "group/row relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-lg border border-transparent px-3 py-3.5 transition-colors hover:border-line hover:bg-card sm:gap-x-4 sm:px-4",
        className,
      )}
    >
      <span aria-hidden className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-beige text-ink">
        <SourceIcon className="size-4" />
      </span>

      <div className="min-w-0">
        <h3 className={cn("text-base leading-snug font-medium tracking-normal break-words", closed && "text-muted-foreground")}>
          {href ? (
            <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        {item.user_note || item.intent ? (
          <p className="mt-0.5 line-clamp-2 text-[15px] leading-normal text-ink/85">{item.user_note || item.intent}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.status !== "inbox" ? <StatusLabel status={item.status} /> : null}
          <AnalysisLabel state={item.analysis_status} />
          {item.category ? <CategoryLabel>{item.category.name}</CategoryLabel> : null}
          <ComingBack item={item} />
          <span className="text-[13px] text-muted-foreground">
            {host ? `${host} · ` : ""}saved <time dateTime={item.created_at}>{saved}</time>
          </span>
        </div>
      </div>

      {onAction ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${title}`}
            className="relative z-10 -mr-1 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-beige hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {item.status === "completed" ? (
              <DropdownMenuItem onClick={() => onAction("reopen", item)}>
                <RotateCcw aria-hidden /> Not done yet
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onAction("complete", item)}>
                <CheckCircle2 aria-hidden /> Mark as done
              </DropdownMenuItem>
            )}
            {item.status === "archived" ? (
              <DropdownMenuItem onClick={() => onAction("restore", item)}>
                <ArchiveRestore aria-hidden /> Move to inbox
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onAction("archive", item)}>
                <Archive aria-hidden /> Archive
              </DropdownMenuItem>
            )}
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

/** "Back Sat 21 Nov" or "Snoozed until …": when an item is set to come back to Resurfaced. */
function ComingBack({ item }: { item: Intention }) {
  const now = useNow();
  if (!now) return null;
  const snoozed = item.snoozed_until && new Date(item.snoozed_until).getTime() > now ? new Date(item.snoozed_until) : null;
  const back = item.resurface_at && new Date(item.resurface_at).getTime() > now ? new Date(item.resurface_at) : null;
  if (!snoozed && !back) return null;
  const Icon = snoozed ? Clock3 : CalendarClock;
  return (
    <span className="inline-flex h-6 items-center gap-1 text-[13px] text-muted-foreground">
      <Icon aria-hidden className="size-3.5" />
      {snoozed ? `Snoozed until ${format(snoozed, "EEE d MMM")}` : `Back ${format(back!, "EEE d MMM")}`}
    </span>
  );
}
