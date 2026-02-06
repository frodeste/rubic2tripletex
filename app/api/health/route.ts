import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getEnabledTripletexEnvs } from "@/config";
import { db } from "@/db/client";
import type { TripletexEnv } from "@/db/schema";
import { syncState } from "@/db/schema";

export async function GET() {
	try {
		const syncTypes = ["customers", "products", "invoices", "payments"] as const;
		const enabledEnvs = getEnabledTripletexEnvs();
		const enabledEnvNames = enabledEnvs.map((e) => e.env);

		const statuses: Record<
			string,
			Record<string, { status: string; lastSync: string | null }>
		> = {};

		for (const env of enabledEnvNames) {
			statuses[env] = {};
			for (const syncType of syncTypes) {
				const [latest] = await db
					.select()
					.from(syncState)
					.where(
						and(
							eq(syncState.syncType, syncType),
							eq(syncState.tripletexEnv, env as TripletexEnv),
						),
					)
					.orderBy(desc(syncState.completedAt))
					.limit(1);

				statuses[env][syncType] = {
					status: latest?.status ?? "never_run",
					lastSync: latest?.completedAt?.toISOString() ?? null,
				};
			}
		}

		return NextResponse.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			enabledEnvironments: enabledEnvNames,
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
