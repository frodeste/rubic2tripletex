import { RubicClient } from "@/clients/rubic";
import { TripletexClient } from "@/clients/tripletex";
import { getConfig, getPartialConfig } from "@/config";
import { db } from "@/db/client";
import { syncPayments } from "@/sync/payments";

/**
 * API route handler for payment sync cron job.
 * Verifies CRON_SECRET if configured, then syncs payments from Rubic to Tripletex.
 */
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
		// Get full config for client instantiation
		const config = getConfig();

		// Instantiate clients
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
		const result = await syncPayments(rubicClient, tripletexClient, db);

		return Response.json({
			success: true,
			processed: result.processed,
			failed: result.failed,
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
