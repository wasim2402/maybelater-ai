import { AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Nothing here yet: says what this place is for and offers the one next step. */
export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-4 rounded-xl bg-beige/60 px-6 py-8 sm:px-8", className)}>
      <span aria-hidden className="flex size-11 items-center justify-center rounded-lg bg-card text-sage-deep">
        <Icon className="size-5" />
      </span>
      <div className="max-w-prose space-y-1.5">
        <h2 className="text-xl leading-tight">{title}</h2>
        {children ? <div className="text-[15px] text-ink/85">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/** Loading placeholder shaped like the list it replaces, so nothing jumps when data arrives. */
export function ListSkeleton({ rows = 4, label = "Loading your saved items" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-1">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="grid grid-cols-[auto_1fr] gap-4 px-4 py-3.5">
          <Skeleton className="size-9" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Something failed: plain words about what happened, what is safe, and how to retry. */
export function ErrorState({ title, children, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-card px-6 py-6", className)}
    >
      <p className="inline-flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle aria-hidden className="size-4" />
        {title}
      </p>
      {children ? <div className="text-[15px] text-ink/85">{children}</div> : null}
      {action}
    </div>
  );
}

/** Inline confirmation after a real, finished action. */
export function SuccessNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="status" className={cn("inline-flex items-center gap-2 text-[15px] font-medium text-success", className)}>
      <CheckCircle2 aria-hidden className="size-4" />
      {children}
    </p>
  );
}
