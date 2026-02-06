import { NextResponse } from "next/server";
import { auth0 } from "@/auth0";
import { TripletexClient } from "@/clients/tripletex";
import { RubicClient } from "@/clients/rubic";
import { getConfig, getTripletexEnvConfig } from "@/config";
import { db } from "@/db/client";
import type { TripletexEnv } from "@/db/schema";
import { logger } from "@/logger";
import { syncCustomers } from "@/sync/customers";
import { syncInvoices } from "@/sync/invoices";
import { syncPayments } from "@/sync/payments";
import { syncProducts } from "@/sync/products";

const VALID_SYNC_TYPES = ["customers", "products", "invoices", "payments"] as const;
type SyncType = (typeof VALID_SYNC_TYPES)[number];

const VALID_ENVS = ["sandbox", "production"] as const;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ syncType: string }> },
) {
	const session = await auth0.getSession();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { syncType } = await params;

	if (!VALID_SYNC_TYPES.includes(syncType as SyncType)) {
		return NextResponse.json(
			{ error: `Invalid sync type. Must be one of: ${VALID_SYNC_TYPES.join(", ")}` },
			{ status: 400 },
		);
	}

	// Get target environment from query params (defaults to "production")
	const url = new URL(request.url);
	const envParam = (url.searchParams.get("env") ?? "production") as TripletexEnv;

	if (!VALID_ENVS.includes(envParam)) {
		return NextResponse.json(
			{ error: `Invalid environment. Must be one of: ${VALID_ENVS.join(", ")}` },
			{ status: 400 },
		);
	}

	// Validate the requested environment is enabled
	const envConfig = getTripletexEnvConfig(envParam);
	if (!envConfig) {
		return NextResponse.json(
			{ error: `Tripletex environment '${envParam}' is not enabled or credentials are missing` },
			{ status: 400 },
		);
	}

	try {
		const config = getConfig();

		const rubicClient = new RubicClient({
			baseUrl: config.RUBIC_API_BASE_URL,
			apiKey: config.RUBIC_API_KEY,
			organizationId: config.RUBIC_ORGANIZATION_ID,
		});

		const tripletexClient = new TripletexClient({
			baseUrl: envConfig.baseUrl,
			consumerToken: envConfig.consumerToken,
			employeeToken: envConfig.employeeToken,
		});

		let result: { processed: number; failed: number };

		switch (syncType as SyncType) {
			case "customers":
				result = await syncCustomers(rubicClient, tripletexClient, db, envParam);
				break;
			case "products":
				result = await syncProducts(rubicClient, tripletexClient, db, envParam);
				break;
			case "invoices":
				result = await syncInvoices(rubicClient, tripletexClient, db, envParam);
				break;
			case "payments":
				result = await syncPayments(rubicClient, tripletexClient, db, envParam);
				break;
			default:
				return NextResponse.json({ error: "Unknown sync type" }, { status: 400 });
		}

		logger.info(`Manual sync triggered: ${syncType}`, "trigger", {
			user: session.user.email,
			tripletexEnv: envParam,
			...result,
		});

		return NextResponse.json({
			success: true,
			syncType,
			tripletexEnv: envParam,
			...result,
		});
	} catch (error) {
		logger.error(`Manual sync failed: ${syncType}`, "trigger", {
			user: session.user.email,
			tripletexEnv: envParam,
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				syncType,
				tripletexEnv: envParam,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
