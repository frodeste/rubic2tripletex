import { NextResponse } from "next/server";
import { RubicClient } from "@/clients/rubic";
import { TripletexClient } from "@/clients/tripletex";
import { getConfig } from "@/config";
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

		// Instantiate clients from env vars
		const rubicClient = new RubicClient({
			baseUrl: config.RUBIC_API_BASE_URL,
			apiKey: config.RUBIC_API_KEY,
			organizationId: config.RUBIC_ORGANIZATION_ID,
		});

		const tripletexClient = new TripletexClient({
			baseUrl: config.TRIPLETEX_API_BASE_URL,
			consumerToken: config.TRIPLETEX_CONSUMER_TOKEN,
			employeeToken: config.TRIPLETEX_EMPLOYEE_TOKEN,
		});

		// Run sync
		const result = await syncCustomers(rubicClient, tripletexClient, db);

		return NextResponse.json({
			success: true,
			processed: result.processed,
			failed: result.failed,
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
