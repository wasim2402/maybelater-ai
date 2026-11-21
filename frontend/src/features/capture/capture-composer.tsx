"use client";

import { useGSAP } from "@gsap/react";
import { zodResolver } from "@hookform/resolvers/zod";
import gsap from "gsap";
import { Link2, NotebookPen, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { cn } from "cn";

import { SuccessNote } from "@/components/feedback/state-views";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { captureSchema, detectSourceType, toCaptureInput, type CaptureInput, type CaptureValues } from "./capture-schema";

gsap.registerPlugin(useGSAP);

interface CaptureComposerProps {
  /** Persists the capture. Reject with an Error to show its message; the typed text is kept. */
  onCapture: (input: CaptureInput) => Promise<void>;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Quick capture: one field for a link or a thought, an optional "why" note, saved with Enter + Cmd/Ctrl.
 * The original text is sent exactly as typed; AI analysis happens after saving and never blocks it.
 */
export function CaptureComposer({ onCapture, autoFocus, className }: CaptureComposerProps) {
  const id = useId();
  const [showNote, setShowNote] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const rootRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CaptureValues>({ resolver: zodResolver(captureSchema), defaultValues: { content: "", note: "" } });

  const content = useWatch({ control, name: "content" }) ?? "";
  const kind = content.trim() ? detectSourceType(content) : null;

  const { contextSafe } = useGSAP({ scope: rootRef });
  const confirmSaved = contextSafe(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      "[data-capture-field]",
      { boxShadow: "0 0 0 0px rgb(139 154 110 / 0.55)" },
      { boxShadow: "0 0 0 8px rgb(139 154 110 / 0)", duration: 0.7, ease: "power2.out" },
    );
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSaved(false);
    try {
      await onCapture(toCaptureInput(values));
      reset();
      setShowNote(false);
      setSaved(true);
      confirmSaved();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Saving failed. Your text is still here; try again.");
    }
  });

  const contentError = errors.content?.message;
  const noteError = errors.note?.message;

  return (
    <form ref={rootRef} onSubmit={onSubmit} noValidate className={cn("space-y-3", className)} aria-label="Save something for later">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-content`} className="text-sm font-medium">
          Link or thought
        </label>
        <div data-capture-field className="relative rounded-md">
          <Textarea
            id={`${id}-content`}
            autoFocus={autoFocus}
            rows={3}
            placeholder="https://… or “Try the ramen place Ana mentioned”"
            aria-invalid={contentError ? true : undefined}
            aria-describedby={contentError ? `${id}-content-error` : `${id}-content-hint`}
            className="max-h-64 min-h-28 pr-4 pb-10 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void onSubmit();
              }
            }}
            {...register("content", { onChange: () => setSaved(false) })}
          />
          <span
            aria-live="polite"
            className="pointer-events-none absolute bottom-2.5 left-3.5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            {kind === "url" ? (
              <>
                <Link2 aria-hidden className="size-3.5" /> Saving as a link
              </>
            ) : kind === "text" ? (
              <>
                <NotebookPen aria-hidden className="size-3.5" /> Saving as a note
              </>
            ) : null}
          </span>
        </div>
        {contentError ? (
          <p id={`${id}-content-error`} className="text-sm text-destructive">
            {contentError}
          </p>
        ) : (
          <p id={`${id}-content-hint`} className="text-[13px] text-muted-foreground">
            We keep exactly what you paste. Suggestions come after it is saved.
          </p>
        )}
      </div>

      {showNote ? (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Why you are saving it <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id={`${id}-note`}
            rows={2}
            className="min-h-16"
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${id}-note-error` : undefined}
            {...register("note")}
          />
          {noteError ? (
            <p id={`${id}-note-error`} className="text-sm text-destructive">
              {noteError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!showNote ? (
          <Button type="button" variant="ghost" className="justify-start px-3 text-ink/85" onClick={() => setShowNote(true)}>
            <Plus aria-hidden /> Add why you are saving it
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Saving…" : "Save for later"}
          <kbd className="ml-1 hidden rounded-sm bg-on-sage/10 px-1.5 font-mono text-xs sm:inline">Ctrl ↵</kbd>
        </Button>
      </div>

      <div aria-live="polite" className="min-h-6">
        {saved ? <SuccessNote>Saved to your inbox.</SuccessNote> : null}
        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}
      </div>
    </form>
  );
}
