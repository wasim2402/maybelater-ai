import { z } from "zod";

/** Mirrors backend app/schemas/intentions.py. */
export const intentionStatusSchema = z.enum(["inbox", "active", "completed", "archived"]);
export const analysisStatusSchema = z.enum(["pending", "ready", "failed", "off"]);
export const sourceTypeSchema = z.enum(["text", "url", "image", "voice"]);

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  is_system: z.boolean(),
});

export const intentionSchema = z.object({
  id: z.string().uuid(),
  source_type: sourceTypeSchema,
  original_content: z.string(),
  original_url: z.string().nullable(),
  user_note: z.string().nullable(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  intent: z.string().nullable(),
  category: categorySchema.nullable(),
  tags: z.array(z.string()),
  resurface_condition: z.string().nullable(),
  field_states: z.record(z.string(), z.string()),
  analysis_status: analysisStatusSchema,
  status: intentionStatusSchema,
  resurface_at: z.string().nullable(),
  snoozed_until: z.string().nullable(),
  completed_at: z.string().nullable(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  suggestion_confidence: z.number().nullable().optional(),
});

export const intentionPageSchema = z.object({
  items: z.array(intentionSchema),
  next_cursor: z.string().nullable(),
});

export const captureResultSchema = z.object({
  result: z.enum(["created", "duplicate", "replayed"]),
  item: intentionSchema,
});

export type IntentionStatus = z.infer<typeof intentionStatusSchema>;
export type AnalysisState = z.infer<typeof analysisStatusSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Intention = z.infer<typeof intentionSchema>;
export type IntentionPage = z.infer<typeof intentionPageSchema>;
export type CaptureResult = z.infer<typeof captureResultSchema>;

/** Inbox filter tabs; "open" = inbox + active. */
export type StatusFilter = "open" | "completed" | "archived" | "all";

/** "Saved within" presets for the date filter. */
export type SincePreset = "7d" | "30d" | "year";

/** Everything the inbox can filter by. Mirrors GET /api/v1/intentions query parameters. */
export interface IntentionFilters {
  status: StatusFilter;
  q?: string;
  /** A category id, or "none" for items without a category. */
  category?: string;
  tag?: string;
  since?: SincePreset;
}

export const tagCountSchema = z.object({ tag: z.string(), count: z.number() });
export type TagCount = z.infer<typeof tagCountSchema>;

/** Whether a field's value came from AI and what the user did with it (stage 07 shows these). */
export type SuggestionState = "suggested" | "accepted" | "edited" | "dismissed";

/** Fields AI can suggest (backend SuggestionField). */
export type SuggestionKey = "title" | "summary" | "intent" | "category" | "tags" | "resurface_condition";

export interface SuggestedField {
  key: SuggestionKey;
  label: string;
  value: string;
  state: SuggestionState;
  /** Free-text fields can be edited in place; category and tags are edited in the details form. */
  editable: boolean;
}

export type IntentionUpdate = Partial<{
  title: string;
  summary: string;
  intent: string;
  user_note: string;
  category_id: string | null;
  tags: string[];
  resurface_condition: string;
  status: IntentionStatus;
}>;
