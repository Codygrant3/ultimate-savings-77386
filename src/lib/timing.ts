import type { RedemptionTimeWindow } from "../types";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeOfDay(value: string): number | null {
  const match = value.match(TIME_PATTERN);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidRedemptionWindows(
  windows: RedemptionTimeWindow[] | undefined
): boolean {
  if (windows === undefined) return true;
  if (!Array.isArray(windows) || windows.length === 0) return false;

  return windows.every((window) => {
    if (typeof window !== "object" || window === null) return false;
    const start =
      typeof window.startTime === "string"
        ? parseTimeOfDay(window.startTime)
        : null;
    if (start === null) return false;
    if (window.endTime === undefined) return true;

    const end =
      typeof window.endTime === "string"
        ? parseTimeOfDay(window.endTime)
        : null;
    return end !== null && start < end;
  });
}

export function formatTimeOfDay(value: string): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) return value;

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatRedemptionWindows(
  windows: RedemptionTimeWindow[]
): string {
  return windows
    .map(({ startTime, endTime }) =>
      endTime === undefined
        ? `after ${formatTimeOfDay(startTime)}`
        : `${formatTimeOfDay(startTime)}-${formatTimeOfDay(endTime)}`
    )
    .join(", ");
}

export function redemptionTimingWarnings(
  windows: RedemptionTimeWindow[],
  now: Date
): string[] {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const parsed = windows.map((window) => ({
    ...window,
    start: parseTimeOfDay(window.startTime)!,
    end: window.endTime === undefined ? null : parseTimeOfDay(window.endTime)!
  }));

  if (
    parsed.some(
      ({ start, end }) =>
        currentMinutes >= start && (end === null || currentMinutes < end)
    )
  ) {
    return ["An official redemption window is active now."];
  }

  const upcoming = parsed
    .filter(({ end }) => end === null || currentMinutes < end)
    .sort((first, second) => first.start - second.start)[0];
  if (upcoming && currentMinutes < upcoming.start) {
    return [
      `Official redemption starts at ${formatTimeOfDay(upcoming.startTime)}; confirm before traveling.`
    ];
  }

  return ["No official redemption window is active now."];
}
