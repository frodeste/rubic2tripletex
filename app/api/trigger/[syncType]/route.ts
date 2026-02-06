import { NextResponse } from "next/server";
import { auth0 } from "@/auth0";
import { RubicClient } from "@/clients/rubic";
import { TripletexClient } from "@/clients/tripletex";
import { db } from "@/db/client";
import { logger } from "@/logger";
import { syncCustomers } from "@/sync/customers";
import { syncInvoices } from "@/sync/invoices";
import { syncPayments } from "@/sync/payments";
import { syncProducts } from "@/sync/products";

const VALID_SYNC_TYPES = ["customers", "products", "invoices", "payments"] as const;
type SyncType = (typeof VALID_SYNC_TYPES)[number];

export async function POST(
	_request: Request,
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

	try {
		const rubicClient = new RubicClient({
			baseUrl: process.env.RUBIC_API_BASE_URL ?? "https://rubicexternalapitest.azurewebsites.net",
			apiKey: process.env.RUBIC_API_KEY ?? "",
			organizationId: Number.parseInt(process.env.RUBIC_ORGANIZATION_ID ?? "0", 10),
		});

		const tripletexClient = new TripletexClient({
			baseUrl: process.env.TRIPLETEX_API_BASE_URL ?? "https://tripletex.no/v2",
			consumerToken: process.env.TRIPLETEX_CONSUMER_TOKEN ?? "",
			employeeToken: process.env.TRIPLETEX_EMPLOYEE_TOKEN ?? "",
		});

		let result: { processed: number; failed: number };

		switch (syncType as SyncType) {
			case "customers":
				result = await syncCustomers(rubicClient, tripletexClient, db);
				break;
			case "products":
				result = await syncProducts(rubicClient, tripletexClient, db);
				break;
			case "invoices":
				result = await syncInvoices(rubicClient, tripletexClient, db);
				break;
			case "payments":
				result = await syncPayments(rubicClient, tripletexClient, db);
				break;
			default:
				return NextResponse.json({ error: "Unknown sync type" }, { status: 400 });
		}

		logger.info(`Manual sync triggered: ${syncType}`, "trigger", {
			user: session.user.email,
			...result,
		});

		return NextResponse.json({
			success: true,
			syncType,
			...result,
		});
	} catch (error) {
		logger.error(`Manual sync failed: ${syncType}`, "trigger", {
			user: session.user.email,
			error: error instanceof Error ? error.message : String(error),
		});

		return NextResponse.json(
			{
				success: false,
				syncType,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
