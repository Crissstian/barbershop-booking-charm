export const SLOT_STEP_MINUTES = 10;
export const OUTSIDE_HOURS_MESSAGE = "Questo appuntamento è fuori dall'orario di lavoro configurato.";
export type Window = { start: number; end: number };
export function withinWorkingWindow(start: number, duration: number, windows: Window[]) {
  return windows.some((w) => start >= w.start && start + duration * 60000 <= w.end);
}
export function availableStarts(windows: Window[], busy: Window[], duration: number, minStart: number) {
  const starts = new Set<number>();
  for (const w of windows) {
    for (let t = w.start; t + duration * 60000 <= w.end; t += SLOT_STEP_MINUTES * 60000) {
      if (t >= minStart && !busy.some((b) => b.start < t + duration * 60000 && b.end > t)) starts.add(t);
    }
  }
  return [...starts].sort((a, b) => a - b);
}
export function requireWorkingHoursConfirmation(inside: boolean, confirmed: boolean) {
  if (!inside && !confirmed) throw new Error(OUTSIDE_HOURS_MESSAGE + " Conferma eccezione.");
}