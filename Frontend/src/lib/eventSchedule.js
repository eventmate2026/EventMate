export const COMPLETION_GRACE_MS = 6 * 60 * 60 * 1000;

const extractYMD = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        monthIndex: Number(match[2]) - 1,
        day: Number(match[3]),
      };
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getUTCFullYear(),
    monthIndex: parsed.getUTCMonth(),
    day: parsed.getUTCDate(),
  };
};

export const buildScheduleDateTime = (dateValue, timeValue, { fallbackToEndOfDay = false } = {}) => {
  const parts = extractYMD(dateValue);
  if (!parts) return null;

  const [hoursText, minutesText] = String(timeValue || "").split(":");
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);

  const resolvedHours = Number.isInteger(hours) ? hours : fallbackToEndOfDay ? 23 : 0;
  const resolvedMinutes = Number.isInteger(minutes) ? minutes : fallbackToEndOfDay ? 59 : 0;
  const resolvedSeconds = fallbackToEndOfDay ? 59 : 0;
  const resolvedMilliseconds = fallbackToEndOfDay ? 999 : 0;

  return new Date(
    parts.year,
    parts.monthIndex,
    parts.day,
    resolvedHours,
    resolvedMinutes,
    resolvedSeconds,
    resolvedMilliseconds
  );
};

export const buildRegistrationEventEndDateTime = (registration) =>
  buildScheduleDateTime(registration?.eventEndDate || registration?.eventStartDate, registration?.eventEndTime, {
    fallbackToEndOfDay: true,
  });

export const isRegistrationEventCompleted = (registration) => {
  const status = String(registration?.eventStatus || "").trim().toLowerCase();
  if (status === "completed" || status === "cancelled" || status === "canceled") return true;

  const endDateTime = buildRegistrationEventEndDateTime(registration);
  if (!endDateTime) return false;
  return Date.now() >= endDateTime.getTime() + COMPLETION_GRACE_MS;
};
