"use client";

import { BellRing, Inbox, Plus, Repeat2, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaptureComposer, type CaptureOutcome } from "@/features/capture/capture-composer";
import type { CaptureInput } from "@/features/capture/capture-schema";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

/** Main areas. Done items live under the inbox's "Done" filter. */
export const APP_NAV: NavItem[] = [
  { href: "/app", label: "Inbox", icon: Inbox },
  { href: "/app/resurfaced", label: "Resurfaced", icon: Repeat2 },
  { href: "/app/reminders", label: "Reminders", icon: BellRing },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
  /** Saves a capture. Without it (until stage 06) the capture buttons are not shown. */
  onCapture?: (input: CaptureInput, requestId: string) => Promise<CaptureOutcome>;
  /** Optional control of the capture dialog (e.g. an empty state's "Save your first link" button). */
  captureOpen?: boolean;
  onCaptureOpenChange?: (open: boolean) => void;
  /** Shown at the foot of the sidebar: who is signed in. */
  account?: { name: string; email: string };
  nav?: NavItem[];
  /** Overrides the active route, e.g. in the design reference. */
  current?: string;
  /** Renders inside a bounded frame instead of the full viewport (design reference). */
  framed?: boolean;
}

/**
 * The authenticated app frame: a quiet sidebar on desktop, a top bar and bottom tabs on phones,
 * and one capture button that is always one tap away.
 */
export function AppShell({
  children,
  onCapture,
  account,
  nav = APP_NAV,
  current,
  framed = false,
  captureOpen: controlledOpen,
  onCaptureOpenChange,
}: AppShellProps) {
  const pathname = usePathname();
  const active = current ?? pathname;
  const [ownOpen, setOwnOpen] = useState(false);
  const captureOpen = controlledOpen ?? ownOpen;
  const setCaptureOpen = onCaptureOpenChange ?? setOwnOpen;

  const isActive = (href: string) => (href === "/app" ? active === "/app" : active.startsWith(href));

  return (
    <div
      className={cn(
        "grid bg-paper text-ink md:grid-cols-[15rem_minmax(0,1fr)]",
        framed ? "h-[44rem] overflow-hidden rounded-xl border border-line" : "min-h-svh",
      )}
    >
      {/* Desktop sidebar */}
      <aside className={cn("hidden flex-col border-r border-line bg-beige/45 px-3 py-5 md:flex", !framed && "sticky top-0 h-svh")}>
        <Link href="/app" className="mb-6 px-3 font-heading text-xl tracking-tight">
          MaybeLater
        </Link>
        {onCapture ? (
          <Button onClick={() => setCaptureOpen(true)} className="mb-5 w-full justify-start">
            <Plus aria-hidden /> Save something
          </Button>
        ) : null}
        <nav aria-label="Main">
          <ul className="space-y-0.5">
            {nav.map(({ href, label, icon: Icon, count }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors",
                    isActive(href) ? "bg-card text-ink shadow-[inset_0_0_0_1px_var(--brand-line)]" : "text-ink/80 hover:bg-card/70 hover:text-ink",
                  )}
                >
                  <Icon aria-hidden className={cn("size-4", isActive(href) && "text-sage-deep")} />
                  <span className="flex-1">{label}</span>
                  {count ? <span className="text-[13px] text-muted-foreground tabular-nums">{count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {account ? (
          <div className="mt-auto border-t border-line px-3 pt-4">
            <p className="truncate text-[15px] font-medium">{account.name}</p>
            <p className="truncate text-[13px] text-muted-foreground">{account.email}</p>
          </div>
        ) : null}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        {/* Phone top bar */}
        <header className="flex h-14 items-center justify-between border-b border-line bg-paper px-4 md:hidden">
          <Link href="/app" className="font-heading text-lg tracking-tight">
            MaybeLater
          </Link>
          {onCapture ? (
            <Button size="icon" aria-label="Save something" onClick={() => setCaptureOpen(true)}>
              <Plus aria-hidden className="size-5" />
            </Button>
          ) : null}
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-24 sm:px-8 md:pb-10 lg:px-12">
          {children}
        </main>

        {/* Phone bottom tabs */}
        <nav
          aria-label="Main"
          className={cn(
            "z-20 grid auto-cols-fr grid-flow-col border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden",
            !framed && "fixed inset-x-0 bottom-0",
          )}
        >
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[13px] font-medium",
                isActive(href) ? "text-sage-deep" : "text-muted-foreground",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {onCapture ? (
      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent className="top-[12%] translate-y-0 gap-4 p-5 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Save something for later</DialogTitle>
            <DialogDescription className="text-[15px] text-ink/80">
              A link or a thought. You can add details later.
            </DialogDescription>
          </DialogHeader>
          <CaptureComposer
            autoFocus
            onCapture={async (input, requestId) => {
              const outcome = await onCapture(input, requestId);
              setCaptureOpen(false); // the shell's toast confirms the save
              return outcome;
            }}
          />
        </DialogContent>
      </Dialog>
      ) : null}
    </div>
  );
}
