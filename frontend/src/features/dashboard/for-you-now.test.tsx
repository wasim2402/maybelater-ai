import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyMotionPreference, prefersReducedMotion } from "@/lib/motion";

import { ForYouNow, QuickCapture } from "./for-you-now";

const item = (id: string, title: string) => ({
  id,
  source_type: "text",
  original_content: title,
  original_url: null,
  title,
  user_note: null,
  intent: null,
});

const state = {
  due: { data: undefined as unknown, isError: false, refetch: vi.fn() },
  recs: { data: undefined as unknown, isError: false, refetch: vi.fn() },
};

vi.mock("@/features/reminders/api", () => ({ useReminders: () => state.due }));
vi.mock("@/features/resurfacing/api", () => ({ useRecommendations: () => state.recs }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  state.due = { data: { items: [], delivery_paused: false }, isError: false, refetch: vi.fn() };
  state.recs = { data: { items: [], generated_at: "" }, isError: false, refetch: vi.fn() };
});

describe("ForYouNow", () => {
  it("shows nothing when nothing is due: no made-up content", () => {
    const { container } = render(<ForYouNow userZone="Europe/Berlin" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing while loading", () => {
    state.due = { data: undefined, isError: false, refetch: vi.fn() };
    state.recs = { data: undefined, isError: false, refetch: vi.fn() };
    const { container } = render(<ForYouNow />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists due reminders and resurfaced items with links to the full pages", () => {
    state.due.data = {
      items: [{ id: "r1", local_time: "2026-11-21T10:00", timezone: "Europe/Berlin", item: item("i1", "Call the bike shop") }],
      delivery_paused: false,
    };
    state.recs.data = {
      items: [
        { item: item("i2", "Lemon cake recipe"), reason: "You asked to see this again today." },
        { item: item("i3", "Rain jackets"), reason: "Your snooze ended yesterday." },
      ],
      generated_at: "",
    };
    render(<ForYouNow userZone="Europe/Berlin" />);

    expect(screen.getByRole("heading", { name: "Back for you" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call the bike shop" })).toHaveAttribute("href", "/app/items/i1");
    expect(screen.getByText("Reminder for Sat 21 Nov, 10:00")).toBeInTheDocument();
    expect(screen.getByText("You asked to see this again today.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All due reminders \(1\)/ })).toHaveAttribute("href", "/app/reminders");
    expect(screen.getByRole("link", { name: /All resurfaced \(2\)/ })).toHaveAttribute("href", "/app/resurfaced");
  });

  it("explains an API failure and retries only what failed", async () => {
    state.recs = { data: undefined, isError: true, refetch: vi.fn() };
    render(<ForYouNow />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't check what's due. Your items are safe.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.recs.refetch).toHaveBeenCalledOnce();
    expect(state.due.refetch).not.toHaveBeenCalled();
  });
});

describe("QuickCapture", () => {
  it("opens capture", async () => {
    const onOpen = vi.fn();
    render(<QuickCapture onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Save a link or a thought…" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe("motion preference", () => {
  afterEach(() => applyMotionPreference(false));

  it("follows the Settings choice even when the system allows motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
    applyMotionPreference(true);
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    expect(prefersReducedMotion()).toBe(true);
    applyMotionPreference(false);
    expect(document.documentElement.dataset.reduceMotion).toBeUndefined();
  });

  it("follows the system setting", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
  });
});
