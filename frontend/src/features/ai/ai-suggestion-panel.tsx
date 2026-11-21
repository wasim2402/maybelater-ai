"use client";

import { Check, Pencil, Sparkles, X } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnalysisState, SuggestedField } from "@/features/intentions/types";

interface AiSuggestionPanelProps {
  fields: SuggestedField[];
  analysis: AnalysisState;
  onAccept: (key: SuggestedField["key"]) => void;
  onEdit: (key: SuggestedField["key"], value: string) => void;
  onDismiss: (key: SuggestedField["key"]) => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * AI suggestions, kept visibly apart from what the user confirmed:
 * suggested fields sit on a pale sage wash with a dashed edge and the word "Suggested";
 * accepted or edited fields turn solid and say "Confirmed". Nothing is applied without a click.
 */
export function AiSuggestionPanel({
  fields,
  analysis,
  onAccept,
  onEdit,
  onDismiss,
  onRetry,
  className,
}: AiSuggestionPanelProps) {
  const visible = fields.filter((f) => f.state !== "dismissed");

  return (
    <section aria-labelledby="ai-panel-title" className={cn("rounded-xl border border-line bg-card p-4 sm:p-5", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="ai-panel-title" className="inline-flex items-center gap-2 text-base font-medium tracking-normal">
          <Sparkles aria-hidden className="size-4 text-sage-deep" />
          Suggestions
        </h2>
        <span className="text-[13px] text-muted-foreground">You decide what to keep</span>
      </header>

      {analysis === "pending" ? (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-sage-soft/60 px-3 py-3 text-[15px]">
          <Sparkles aria-hidden className="size-4 animate-pulse text-sage-deep" />
          Reading what you saved. Your item is already safe.
        </p>
      ) : analysis === "failed" ? (
        <div role="alert" className="space-y-2 rounded-lg border border-dashed border-line px-3 py-3 text-[15px]">
          <p>Suggestions could not be made this time. Your item is saved as you wrote it.</p>
          {onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try suggestions again
            </Button>
          ) : null}
        </div>
      ) : analysis === "off" ? (
        <p className="text-[15px] text-muted-foreground">Suggestions are turned off for this item.</p>
      ) : visible.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">No suggestions left to review.</p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((field) => (
            <SuggestionRow key={field.key} field={field} onAccept={onAccept} onEdit={onEdit} onDismiss={onDismiss} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SuggestionRow({
  field,
  onAccept,
  onEdit,
  onDismiss,
}: {
  field: SuggestedField;
  onAccept: AiSuggestionPanelProps["onAccept"];
  onEdit: AiSuggestionPanelProps["onEdit"];
  onDismiss: AiSuggestionPanelProps["onDismiss"];
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const confirmed = field.state === "accepted" || field.state === "edited";

  return (
    <li
      data-state={field.state}
      className={cn(
        "rounded-lg px-3 py-2.5",
        confirmed ? "border border-line bg-paper" : "border border-dashed border-sage-deep/45 bg-sage-soft/55",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{field.label}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[13px] font-medium",
            confirmed ? "text-success" : "text-sage-deep",
          )}
        >
          {confirmed ? <Check aria-hidden className="size-3.5" /> : <Sparkles aria-hidden className="size-3.5" />}
          {confirmed ? "Confirmed" : "Suggested"}
        </span>
      </div>

      {editing ? (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const value = draft.trim();
            if (!value) return;
            onEdit(field.key, value);
            setEditing(false);
          }}
        >
          <label htmlFor={`${id}-edit`} className="sr-only">
            {field.label}
          </label>
          <Input id={`${id}-edit`} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="h-11" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-11">
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-11" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-1 text-[15px] leading-normal">{field.value}</p>
      )}

      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {!confirmed ? (
            <Button size="sm" variant="outline" className="h-9 bg-card" onClick={() => onAccept(field.key)}>
              <Check aria-hidden /> Keep
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={() => {
              setDraft(field.value);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden /> Edit
          </Button>
          {!confirmed ? (
            <Button size="sm" variant="ghost" className="h-9" onClick={() => onDismiss(field.key)}>
              <X aria-hidden /> Not this
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
