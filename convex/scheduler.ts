"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Parses a simple cron expression and checks if it should run now.
 * Supports: "* /N * * *" (every N minutes/hours) format.
 * For simplicity, we check if enough time has elapsed since lastScheduledAt.
 */
function parseCronIntervalMs(cronExpression: string): number | null {
	const parts = cronExpression.trim().split(/\s+/);
	if (parts.length !== 5) return null;

	const [minute, hour] = parts;

	// Every N hours: "0 * /N * * *"
	const hourMatch = hour?.match(/^\*\/(\d+)$/);
	if (hourMatch) {
		return Number.parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
	}

	// Every N minutes: "* /N * * * *"
	const minuteMatch = minute?.match(/^\*\/(\d+)$/);
	if (minuteMatch) {
		return Number.parseInt(minuteMatch[1], 10) * 60 * 1000;
	}

	// Every hour: "0 * * * *"
	if (minute === "0" && hour === "*") {
		return 60 * 60 * 1000;
	}

	// Default: check every interval the cron runs (fallback to 1 hour)
	return 60 * 60 * 1000;
}

/**
 * Internal action that checks all enabled schedules and dispatches sync actions
 * for any that are due. Called by the cron job every 5 minutes.
 */
export const checkAndDispatch = internalAction({
	args: {},
	handler: async (ctx) => {
		const schedules = await ctx.runQuery(internal.integrationSchedules.listEnabled, {});
		const now = Date.now();

		for (const schedule of schedules) {
			const intervalMs = parseCronIntervalMs(schedule.cronExpression);
			if (!intervalMs) continue;

			const lastRun = schedule.lastScheduledAt ?? 0;
			const elapsed = now - lastRun;

			if (elapsed < intervalMs) continue;

			// Mark as scheduled
			await ctx.runMutation(internal.integrationSchedules.markScheduled, {
				scheduleId: schedule._id,
			});

			// Dispatch the sync action
			const syncType = schedule.syncType;
			const actionMap = {
				customers: internal.sync.runCustomers,
				products: internal.sync.runProducts,
				invoices: internal.sync.runInvoices,
				payments: internal.sync.runPayments,
			} as const;

			const syncAction = actionMap[syncType as keyof typeof actionMap];
			if (syncAction) {
				try {
					await ctx.runAction(syncAction, {
						organizationId: schedule.organizationId,
						tripletexEnv: schedule.tripletexEnv,
					});

					await ctx.runMutation(internal.integrationSchedules.markCompleted, {
						scheduleId: schedule._id,
					});
				} catch (error) {
					console.error(
						`Scheduled sync failed: ${syncType} for org ${schedule.organizationId}`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}
		}
	},
});
