import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Check all enabled integration schedules every 5 minutes.
 * If a schedule is due based on its cron expression, dispatch the corresponding sync action.
 */
crons.interval("checkSchedules", { minutes: 5 }, internal.scheduler.checkAndDispatch);

export default crons;
