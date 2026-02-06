import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { syncState } from "@/db/schema";

export async function GET() {
	try {
		// Check DB connectivity and get latest sync status for each type
		const syncTypes = ["customers", "products", "invoices", "payments"] as const;
		const statuses: Record<string, { status: string; lastSync: string | null }> = {};

		for (const syncType of syncTypes) {
			const [latest] = await db
				.select()
				.from(syncState)
				.where(eq(syncState.syncType, syncType))
				.orderBy(desc(syncState.completedAt))
				.limit(1);

			statuses[syncType] = {
				status: latest?.status ?? "never_run",
				lastSync: latest?.completedAt?.toISOString() ?? null,
			};
		}

		return NextResponse.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			syncs: statuses,
		});
	} catch (error) {
		return NextResponse.json(
			{
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
