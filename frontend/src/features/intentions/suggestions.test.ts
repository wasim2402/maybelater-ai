import { describe, expect, it } from "vitest";

import { suggestedFields } from "./suggestions";
import type { Intention } from "./types";

const base: Intention = {
  id: "00000000-0000-4000-8000-000000000001",
  source_type: "url",
  original_content: "https://bread.example/guide",
  original_url: "https://bread.example/guide",
  user_note: null,
  title: "Sourdough guide",
  summary: "How to start a starter.",
  intent: "Possibly to bake at the weekend.",
  category: { id: "00000000-0000-4000-8000-000000000002", name: "Food and cooking", slug: "food-cooking", is_system: true },
  tags: ["baking", "bread"],
  resurface_condition: null,
  field_states: { title: "suggested", summary: "edited", intent: "accepted", category: "suggested", tags: "dismissed" },
  analysis_status: "ready",
  status: "inbox",
  resurface_at: null,
  snoozed_until: null,
  completed_at: null,
  archived_at: null,
  created_at: "2026-11-21T10:00:00Z",
  updated_at: "2026-11-21T10:00:00Z",
};

describe("suggestedFields", () => {
  it("lists suggestions awaiting a decision and kept ones, never the user's own edits or dismissed ones", () => {
    const fields = suggestedFields(base);
    expect(fields.map((f) => [f.key, f.state])).toEqual([
      ["title", "suggested"],
      ["intent", "accepted"],
      ["category", "suggested"],
    ]);
  });

  it("shows category by name and only lets free text be edited in place", () => {
    const category = suggestedFields(base).find((f) => f.key === "category");
    expect(category).toMatchObject({ value: "Food and cooking", editable: false, label: "Category" });
    expect(suggestedFields(base).find((f) => f.key === "title")?.editable).toBe(true);
  });

  it("skips suggested fields with no value", () => {
    expect(suggestedFields({ ...base, title: null }).some((f) => f.key === "title")).toBe(false);
  });
});
