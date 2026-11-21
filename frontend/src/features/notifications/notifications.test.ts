import { afterEach, describe, expect, it, vi } from "vitest";

describe("deviceLabel", () => {
  it("names the browser and system for the device list", async () => {
    const { deviceLabel } = await import("./push");
    const chromeWin = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
    const edge = `${chromeWin} Edg/140.0`;
    const firefoxMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:140.0) Gecko/20100101 Firefox/140.0";
    const androidChrome = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
    expect(deviceLabel(chromeWin)).toBe("Chrome on Windows");
    expect(deviceLabel(edge)).toBe("Edge on Windows");
    expect(deviceLabel(firefoxMac)).toBe("Firefox on macOS");
    expect(deviceLabel(androidChrome)).toBe("Chrome on Android");
    expect(deviceLabel(iphone)).toBe("Safari on iOS");
  });
});

describe("pushSupport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is unsupported without service workers and push", async () => {
    const { pushSupport } = await import("./push");
    expect(pushSupport()).toBe("unsupported"); // jsdom has neither
  });

  it("asks iPhone users to install to the Home Screen first", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Safari/604.1" });
    const { pushSupport } = await import("./push");
    expect(pushSupport()).toBe("needs-install");
  });
});

describe("chime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  function fakeAudio(state: "running" | "suspended") {
    const started: number[] = [];
    class FakeContext {
      state = state;
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      createOscillator() {
        const osc = { type: "", frequency: { value: 0 }, connect: (n: unknown) => n, start: (t: number) => started.push(t), stop: vi.fn() };
        return osc;
      }
      createGain() {
        const gain = {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: (n: unknown) => n,
        };
        return gain;
      }
    }
    vi.stubGlobal("AudioContext", FakeContext);
    return started;
  }

  it("plays two notes once sound is allowed", async () => {
    const started = fakeAudio("running");
    const { playChime } = await import("./chime");
    expect(playChime()).toBe(true);
    expect(started).toHaveLength(2);
  });

  it("stays silent until the user has interacted, then plays", async () => {
    const started = fakeAudio("suspended");
    const { playChime, unlockAudio } = await import("./chime");
    expect(playChime()).toBe(false);
    unlockAudio();
    await Promise.resolve();
    expect(playChime()).toBe(true);
    expect(started).toHaveLength(2);
  });
});
