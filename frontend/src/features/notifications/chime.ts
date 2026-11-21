/**
 * The reminder chime: two soft sine notes (E6 then A6) with gentle fades, made with the Web Audio API,
 * so there is no audio file to load or license. Browsers only allow sound after the user has interacted
 * with the page, so `unlockAudio()` runs on the first tap or key press; before that the chime is skipped
 * (the system notification still plays the device's sound).
 */

type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** Call from a user gesture (pointerdown, keydown) so later chimes are allowed to play. */
export function unlockAudio(): void {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
}

/** Plays the chime. Returns false when the browser doesn't allow sound yet. */
export function playChime(volume = 0.18): boolean {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return false;
  const start = ctx.currentTime + 0.02;
  const notes: [frequency: number, offset: number][] = [
    [1318.5, 0], // E6
    [1760, 0.16], // A6
  ];
  for (const [frequency, offset] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const t = start + offset;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.95);
  }
  return true;
}
