import { RubicClient } from "@/clients/rubic";
import { TripletexClient } from "@/clients/tripletex";
import { getConfig, getEnabledTripletexEnvs, getPartialConfig } from "@/config";
import { db } from "@/db/client";
import { logger } from "@/logger";
import { syncInvoices } from "@/sync/invoices";

export async function GET(request: Request) {
	const partialConfig = getPartialConfig();

	// Verify CRON_SECRET if configured
	if (partialConfig.cronSecret) {
		const authHeader = request.headers.get("authorization");
		const expectedAuth = `Bearer ${partialConfig.cronSecret}`;

		if (authHeader !== expectedAuth) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	try {
		const config = getConfig();

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
				results[envConfig.env] = await syncInvoices(
					rubicClient,
					tripletexClient,
					db,
					envConfig.env,
				);
			} catch (error) {
				logger.error(`Invoice sync failed for ${envConfig.env}`, "sync-invoices-route", {
					env: envConfig.env,
					error: error instanceof Error ? error.message : String(error),
				});
				results[envConfig.env] = { processed: 0, failed: -1 };
			}
		}

		return Response.json({
			success: true,
			results,
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
