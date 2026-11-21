import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CaptureComposer, type CaptureOutcome } from "./capture-composer";

beforeAll(() => {
  // jsdom has no matchMedia; the composer asks it for prefers-reduced-motion.
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

async function type(text: string) {
  const field = screen.getByLabelText("Link or thought");
  await userEvent.clear(field);
  await userEvent.type(field, text);
}

describe("CaptureComposer", () => {
  it("sends text with a link detected as a link", async () => {
    const onCapture = vi.fn<(input: { sourceType: string; content: string }, id: string) => Promise<CaptureOutcome>>().mockResolvedValue("created");
    render(<CaptureComposer onCapture={onCapture} />);
    await type("https://example.com/article");
    expect(screen.getByText("Saving as a link")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Save for later/ }));
    await waitFor(() => expect(screen.getByText("Saved to your inbox.")).toBeInTheDocument());
    expect(onCapture.mock.calls[0][0]).toMatchObject({ sourceType: "url", content: "https://example.com/article" });
    expect(screen.getByLabelText("Link or thought")).toHaveValue(""); // cleared after the server confirmed
  });

  it("retries a failed save with the same attempt id and keeps the text", async () => {
    const onCapture = vi
      .fn<(input: unknown, id: string) => Promise<CaptureOutcome>>()
      .mockRejectedValueOnce(new Error("Could not reach the server. Check your connection."))
      .mockResolvedValueOnce("replayed")
      .mockResolvedValueOnce("created");
    render(<CaptureComposer onCapture={onCapture} />);
    await type("Book the dentist");
    await userEvent.click(screen.getByRole("button", { name: /Save for later/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server");
    expect(screen.getByLabelText("Link or thought")).toHaveValue("Book the dentist");

    await userEvent.click(screen.getByRole("button", { name: /Save for later/ }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(2));
    expect(onCapture.mock.calls[1][1]).toBe(onCapture.mock.calls[0][1]); // same attempt

    await type("Something new");
    await userEvent.click(screen.getByRole("button", { name: /Save for later/ }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(3));
    expect(onCapture.mock.calls[2][1]).not.toBe(onCapture.mock.calls[0][1]); // a new attempt
  });

  it("says when a link is already saved", async () => {
    render(<CaptureComposer onCapture={vi.fn().mockResolvedValue("duplicate")} />);
    await type("https://example.com/again");
    await userEvent.click(screen.getByRole("button", { name: /Save for later/ }));
    expect(await screen.findByText("That link is already in your inbox.")).toBeInTheDocument();
  });

  it("rejects empty and whitespace-only input without calling the server", async () => {
    const onCapture = vi.fn();
    render(<CaptureComposer onCapture={onCapture} />);
    await type("    ");
    await userEvent.click(screen.getByRole("button", { name: /Save for later/ }));
    expect(await screen.findByText("Paste a link or write a thought to save.")).toBeInTheDocument();
    expect(onCapture).not.toHaveBeenCalled();
  });
});
