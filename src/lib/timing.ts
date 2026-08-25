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

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  fryday: 5,
  saturday: 6
};

export function parseRedemptionDaysFromText(
  value: string | undefined
): number[] | undefined {
  if (!value) return undefined;

  const text = value.toLowerCase().replace(/[’]/g, "'");
  const matches = text.match(
    /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|fryday|saturday)\b/gi
  );
  if (!matches) return undefined;

  const days = Array.from(
    new Set(matches.map((day) => DAY_NAMES[day.toLowerCase()]))
  ).sort((first, second) => first - second);
  return days.length > 0 ? days : undefined;
}

function timeToMinutes(
  hour: string,
  minute: string | undefined,
  meridiem: string | undefined
): number {
  let value = Number(hour) % 12;
  const normalizedMeridiem = meridiem?.replace(/[^apm]/gi, "").toLowerCase();
  if (normalizedMeridiem === "pm") value += 12;
  return value * 60 + Number(minute ?? "0");
}

function timeToken(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseRedemptionTimeWindowsFromText(
  value: string | undefined
): RedemptionTimeWindow[] | undefined {
  if (!value) return undefined;

  const text = value.toLowerCase();
  const windows: RedemptionTimeWindow[] = [];
  const rangePattern =
    /(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.)?(?:\s*(?:-|–|to|through)\s*)(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.)/gi;
  for (const match of text.matchAll(rangePattern)) {
    const start = timeToMinutes(match[1], match[2], match[3] ?? match[6]);
    const end = timeToMinutes(match[4], match[5], match[6]);
    if (start < end) {
      windows.push({
        startTime: timeToken(start),
        endTime: timeToken(end)
      });
    }
  }

  if (windows.length === 0) {
    const afterPattern = /after\s+(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.)/i;
    const match = text.match(afterPattern);
    if (match) {
      windows.push({
        startTime: timeToken(timeToMinutes(match[1], match[2], match[3]))
      });
    }
  }

  return windows.length > 0 ? windows : undefined;
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
