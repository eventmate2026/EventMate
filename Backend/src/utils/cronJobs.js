import cron from "node-cron";
import { autoCompleteOverdueEvents } from "../services/eventLifecycle.service.js";

const autoCompleteEvents = async () => {
  try {
    const { updatedCount } = await autoCompleteOverdueEvents();
    if (updatedCount > 0) {
      console.log(`[AUTO_COMPLETE] Completed ${updatedCount} overdue published event(s)`);
    }
  } catch (error) {
    console.error("[AUTO_COMPLETE] Cron job error:", error.message);
  }
};

const startCronJobs = () => {
  void autoCompleteEvents();

  cron.schedule("*/10 * * * *", autoCompleteEvents, {
    timezone: "Asia/Kolkata"
  });
  console.log("[AUTO_COMPLETE] Cron jobs started");
};

export default startCronJobs;
