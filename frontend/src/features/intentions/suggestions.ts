import type { Intention, SuggestedField, SuggestionKey } from "./types";

const SUGGESTION_LABELS: Record<SuggestionKey, string> = {
  title: "Title",
  summary: "Summary",
  intent: "Why you might have saved it",
  category: "Category",
  tags: "Tags",
  resurface_condition: "Bring it back",
};

function suggestionValue(item: Intention, key: SuggestionKey): string {
  if (key === "category") return item.category?.name ?? "";
  if (key === "tags") return item.tags.join(", ");
  return item[key] ?? "";
}

/** AI suggestions waiting for a decision, and the ones already kept. Edited and dismissed fields are
 *  the user's and do not appear here. */
export function suggestedFields(item: Intention): SuggestedField[] {
  return (Object.keys(SUGGESTION_LABELS) as SuggestionKey[])
    .map((key) => ({ key, state: item.field_states[key], value: suggestionValue(item, key) }))
    .filter((f): f is { key: SuggestionKey; state: "suggested" | "accepted"; value: string } => (f.state === "suggested" || f.state === "accepted") && f.value !== "")
    .map((f) => ({ ...f, label: SUGGESTION_LABELS[f.key], editable: f.key !== "category" && f.key !== "tags" }));
}

