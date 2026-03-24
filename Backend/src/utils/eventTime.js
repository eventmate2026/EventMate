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

export const buildEventEndDateTime = (endDate, endTime) => {
  if (!endDate || !endTime) return null;

  const [hours, minutes] = String(endTime).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

  const parts = extractYMD(endDate);
  if (!parts) return null;

  // Create a UTC timestamp that represents the IST calendar date + time.
  const utcMillis =
    Date.UTC(
      parts.year,
      parts.monthIndex,
      parts.day,
      hours,
      minutes,
      0,
      0
    ) -
    IST_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMillis);
};
