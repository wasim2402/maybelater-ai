import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReminderPicker } from "./reminder-picker";
import { formatWallTime, localString, wallClockNow } from "./wall-clock";

describe("wall clock", () => {
  it("reads the time on another zone's clock", () => {
    const instant = Date.UTC(2026, 10, 18, 23, 30); // Wed 23:30 UTC
    expect(localString(wallClockNow(instant, "Europe/Berlin"))).toBe("2026-11-19T00:30");
    expect(localString(wallClockNow(instant, "America/New_York"))).toBe("2026-11-18T18:30");
  });

  it("follows daylight saving on that clock", () => {
    expect(localString(wallClockNow(Date.UTC(2026, 0, 10, 12, 0), "Europe/Berlin"))).toBe("2026-01-10T13:00");
    expect(localString(wallClockNow(Date.UTC(2026, 6, 10, 12, 0), "Europe/Berlin"))).toBe("2026-07-10T14:00");
  });

  it("names the zone only when it differs from the user's", () => {
    expect(formatWallTime("2026-11-21T10:00", "Europe/Berlin", "Europe/Berlin")).toBe("Sat 21 Nov, 10:00");
    expect(formatWallTime("2026-11-21T10:00", "America/New_York", "Europe/Berlin")).toBe("Sat 21 Nov, 10:00 (America/New_York)");
  });
});

describe("ReminderPicker", () => {
  afterEach(() => vi.useRealTimers());

  it("states the exact time and only confirms on the button, as a time on the user's clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 18, 11, 0))); // Wed 12:00 in Berlin
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ReminderPicker timeZone="Europe/Berlin" onConfirm={onConfirm} />);

    expect(screen.getByRole("button", { name: "Set reminder" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /This weekend/ }));
    expect(onConfirm).not.toHaveBeenCalled(); // choosing schedules nothing
    expect(screen.getByText(/You'll be reminded on/)).toHaveTextContent("Saturday 21 November at 10:00 (Europe/Berlin)");

    await user.click(screen.getByRole("button", { name: "Set reminder" }));
    expect(onConfirm).toHaveBeenCalledWith({ local: "2026-11-21T10:00", timezone: "Europe/Berlin" });
  });

  it("offers this evening only while it is still ahead", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 18, 19, 0))); // 20:00 in Berlin
    render(<ReminderPicker timeZone="Europe/Berlin" onConfirm={() => {}} />);
    expect(screen.queryByRole("radio", { name: /This evening/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /Tomorrow morning/ })).toHaveTextContent("Thu 19 Nov, 09:00");
  });
});
