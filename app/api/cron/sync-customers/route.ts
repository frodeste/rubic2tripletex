import { NextResponse } from "next/server";
import { RubicClient } from "@/clients/rubic";
import { TripletexClient } from "@/clients/tripletex";
import { getConfig, getEnabledTripletexEnvs } from "@/config";
import { db } from "@/db/client";
import { logger } from "@/logger";
import { syncCustomers } from "@/sync/customers";

export async function GET(request: Request) {
	try {
		// Verify CRON_SECRET if configured
		const config = getConfig();
		if (config.CRON_SECRET) {
			const authHeader = request.headers.get("authorization");
			const expectedAuth = `Bearer ${config.CRON_SECRET}`;
			if (authHeader !== expectedAuth) {
				logger.warn("Unauthorized cron request", "sync-customers-route", {
					hasAuth: !!authHeader,
				});
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
		}

		const rubicClient = new RubicClient({
			baseUrl: config.RUBIC_API_BASE_URL,
			apiKey: config.RUBIC_API_KEY,
			organizationId: config.RUBIC_ORGANIZATION_ID,
		});

		// Run sync for all enabled Tripletex environments
		const enabledEnvs = getEnabledTripletexEnvs();
		const results: Record<string, { processed: number; failed: number }> = {};

		for (const envConfig of enabledEnvs) {
			const tripletexClient = new TripletexClient({
				baseUrl: envConfig.baseUrl,
				consumerToken: envConfig.consumerToken,
				employeeToken: envConfig.employeeToken,
			});

			try {
				results[envConfig.env] = await syncCustomers(
					rubicClient,
					tripletexClient,
					db,
					envConfig.env,
				);
			} catch (error) {
				logger.error(`Customer sync failed for ${envConfig.env}`, "sync-customers-route", {
					env: envConfig.env,
					error: error instanceof Error ? error.message : String(error),
				});
				results[envConfig.env] = { processed: 0, failed: -1 };
			}
		}

		return NextResponse.json({
			success: true,
			results,
		});
	} catch (error) {
		logger.error("Customer sync route failed", "sync-customers-route", {
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
