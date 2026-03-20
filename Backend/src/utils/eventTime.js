export const COMPLETION_GRACE_MS = 6 * 60 * 60 * 1000;

const IST_OFFSET_MINUTES = 5.5 * 60;

const extractYMD = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        monthIndex: Number(match[2]) - 1,
        day: Number(match[3])
      };
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: date.getUTCFullYear(),
    monthIndex: date.getUTCMonth(),
    day: date.getUTCDate()
  };
};

export const buildScheduleDateTime = (dateValue, timeValue, { fallbackToEndOfDay = false } = {}) => {
  const parts = extractYMD(dateValue);
  if (!parts) return null;

  const [hoursValue, minutesValue] = String(timeValue || "").split(":");
  const hours = Number.parseInt(hoursValue, 10);
  const minutes = Number.parseInt(minutesValue, 10);

  const resolvedHours = Number.isInteger(hours) ? hours : fallbackToEndOfDay ? 23 : 0;
  const resolvedMinutes = Number.isInteger(minutes) ? minutes : fallbackToEndOfDay ? 59 : 0;
  const resolvedSeconds = fallbackToEndOfDay ? 59 : 0;
  const resolvedMilliseconds = fallbackToEndOfDay ? 999 : 0;

  // Create a UTC timestamp that represents the IST calendar date + time.
  const utcMillis =
    Date.UTC(
      parts.year,
      parts.monthIndex,
      parts.day,
      resolvedHours,
      resolvedMinutes,
      resolvedSeconds,
      resolvedMilliseconds
    ) -
    IST_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMillis);
};

export const buildEventStartDateTime = (startDate, startTime) =>
  buildScheduleDateTime(startDate, startTime);

export const buildEventEndDateTime = (endDate, endTime) =>
  buildScheduleDateTime(endDate, endTime, { fallbackToEndOfDay: true });
