import { z } from "zod";

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

export const captureSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Paste a link or write a thought to save.")
    .max(5000, "Keep it under 5,000 characters. Save the rest as a second item."),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

export type CaptureValues = z.infer<typeof captureSchema>;

export type CaptureInput = {
  sourceType: "url" | "text";
  content: string;
  note?: string;
};

/** A capture that is one http(s) link is saved as a URL; anything else as text. */
export function detectSourceType(content: string): CaptureInput["sourceType"] {
  return URL_PATTERN.test(content.trim()) ? "url" : "text";
}

export function toCaptureInput(values: CaptureValues): CaptureInput {
  const content = values.content.trim();
  return {
    sourceType: detectSourceType(content),
    content,
    note: values.note?.trim() || undefined,
  };
}
