export const COMPLETION_GRACE_MS = 6 * 60 * 60 * 1000;

export const buildEventEndDateTime = (endDate, endTime) => {
  if (!endDate || !endTime) return null;

  const [hours, minutes] = String(endTime).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

  const rawDate = new Date(endDate);
  if (Number.isNaN(rawDate.getTime())) return null;

  // Preserve the stored calendar day and merge it with schedule end time.
  return new Date(
    rawDate.getUTCFullYear(),
    rawDate.getUTCMonth(),
    rawDate.getUTCDate(),
    hours,
    minutes,
    0,
    0
  );
};
