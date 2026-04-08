import Event from "../models/Event.model.js";
import { buildEventEndDateTime } from "../utils/eventTime.js";

export const autoCompleteOverdueEvents = async ({ now = new Date() } = {}) => {
  const publishedEvents = await Event.find({ status: "Published" }).select(
    "_id title schedule.startDate schedule.endDate schedule.endTime"
  );

  const updates = [];

  for (const event of publishedEvents) {
    const endDateTime = buildEventEndDateTime(
      event?.schedule?.endDate || event?.schedule?.startDate,
      event?.schedule?.endTime
    );

    if (!endDateTime) continue;
    if (now < endDateTime) continue;

    updates.push(
      Event.updateOne(
        { _id: event._id, status: "Published" },
        {
          $set: {
            status: "Completed",
            updatedAt: now,
          },
        }
      )
    );
  }

  if (!updates.length) {
    return { updatedCount: 0 };
  }

  const results = await Promise.allSettled(updates);
  const updatedCount = results.filter((item) => item.status === "fulfilled").length;
  return { updatedCount };
};
