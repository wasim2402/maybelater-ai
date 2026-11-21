import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SuggestedField } from "@/features/intentions/types";

import { AiSuggestionPanel } from "./ai-suggestion-panel";

const fields: SuggestedField[] = [
  { key: "title", label: "Title", value: "Sourdough guide", state: "suggested", editable: true },
  { key: "category", label: "Category", value: "Food and cooking", state: "suggested", editable: false },
  { key: "intent", label: "Why you might have saved it", value: "Possibly to bake", state: "accepted", editable: true },
];

function setup(props: Partial<React.ComponentProps<typeof AiSuggestionPanel>> = {}) {
  const handlers = { onAccept: vi.fn(), onEdit: vi.fn(), onDismiss: vi.fn(), onRetry: vi.fn() };
  render(<AiSuggestionPanel fields={fields} analysis="ready" {...handlers} {...props} />);
  return handlers;
}

describe("AiSuggestionPanel", () => {
  it("marks suggestions and kept values with words, not colour alone", () => {
    setup();
    expect(screen.getAllByText("Suggested")).toHaveLength(2);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Suggested from what you saved. Nothing changes until you keep it.")).toBeInTheDocument();
  });

  it("keeps, dismisses and edits", async () => {
    const h = setup();
    const [keepTitle] = screen.getAllByRole("button", { name: "Keep" });
    await userEvent.click(keepTitle);
    expect(h.onAccept).toHaveBeenCalledWith("title");
    await userEvent.click(screen.getAllByRole("button", { name: "Not this" })[1]);
    expect(h.onDismiss).toHaveBeenCalledWith("category");

    await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const input = screen.getByLabelText("Title");
    await userEvent.clear(input);
    await userEvent.type(input, "My sourdough notes");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(h.onEdit).toHaveBeenCalledWith("title", "My sourdough notes");
  });

  it("offers Edit only for free-text fields", () => {
    setup();
    // title and intent are editable; category is edited in the details form
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
  });

  it("says when suggestions are rough guesses, without showing a score", () => {
    setup({ lowConfidence: true });
    expect(screen.getByText(/rough guesses/)).toBeInTheDocument();
    expect(screen.queryByText(/%|0\.\d/)).not.toBeInTheDocument();
  });

  it("offers a retry after a failure and shows progress while pending", async () => {
    const h = setup({ analysis: "failed", fields: [] });
    await userEvent.click(screen.getByRole("button", { name: "Try suggestions again" }));
    expect(h.onRetry).toHaveBeenCalled();
  });

  it("shows a calm pending state", () => {
    setup({ analysis: "pending", fields: [] });
    expect(screen.getByRole("status")).toHaveTextContent("Your item is already safe");
  });
});
