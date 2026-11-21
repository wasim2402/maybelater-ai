/**
 * UI model for a saved item ("intention"). The API contract is finalised in stages 04 and 06;
 * keep this type in step with the backend response schema when it lands.
 */
export type IntentionStatus = "inbox" | "scheduled" | "resurfaced" | "snoozed" | "completed" | "archived";

export type SourceType = "url" | "text";

/** Whether a field's value came from AI and what the user did with it. */
export type SuggestionState = "suggested" | "accepted" | "edited" | "dismissed";

export interface SuggestedField {
  key: "title" | "summary" | "reason" | "category" | "resurface";
  label: string;
  value: string;
  state: SuggestionState;
}

export type AnalysisState = "pending" | "ready" | "failed" | "off";

export interface Intention {
  id: string;
  sourceType: SourceType;
  /** Exactly what the user captured. Never overwritten by AI. */
  originalContent: string;
  url: string | null;
  title: string;
  /** Why the user saved it, in their words or an accepted suggestion. */
  reason: string | null;
  category: string | null;
  status: IntentionStatus;
  analysis: AnalysisState;
  createdAt: string;
  remindAt: string | null;
}
