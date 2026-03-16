import cron from "node-cron";
import Event from "../models/Event.model.js";
import { buildEventEndDateTime, COMPLETION_GRACE_MS } from "./eventTime.js";

const autoCompleteEvents = async () => {
  try {
    const now = new Date();
    const publishedEvents = await Event.find({ status: "Published" });

    for (const event of publishedEvents) {
      const eventEndDateTime = buildEventEndDateTime(
        event.schedule?.endDate,
        event.schedule?.endTime
      );

      if (!eventEndDateTime) continue;

      const autoCompleteAt = new Date(eventEndDateTime.getTime() + COMPLETION_GRACE_MS);
      if (now >= autoCompleteAt) {
        await Event.findByIdAndUpdate(event._id, {
          status: "Completed",
          updatedAt: now
        });
        console.log(`[AUTO_COMPLETE] Event marked completed: ${event.title}`);
      }
    }
  } catch (error) {
    console.error("[AUTO_COMPLETE] Cron job error:", error.message);
  }
};

const startCronJobs = () => {
  // Run every hour to reduce load while still completing events promptly.
  cron.schedule("0 * * * *", autoCompleteEvents);
  console.log("[AUTO_COMPLETE] Cron jobs started");
};

export default startCronJobs;
