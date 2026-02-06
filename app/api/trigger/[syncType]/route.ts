import { getSession } from "@auth0/nextjs-auth0";
import { NextResponse } from "next/server";

const VALID_SYNC_TYPES = ["customers", "products", "invoices", "payments"] as const;

export async function POST(_request: Request, { params }: { params: { syncType: string } }) {
	const session = await getSession();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { syncType } = params;

	if (!VALID_SYNC_TYPES.includes(syncType as (typeof VALID_SYNC_TYPES)[number])) {
		return NextResponse.json(
			{ error: `Invalid sync type. Must be one of: ${VALID_SYNC_TYPES.join(", ")}` },
			{ status: 400 },
		);
	}

	// TODO: Wire up actual sync functions in Phase 8
	// For now, return a stub response
	return NextResponse.json({
		success: true,
		message: `Sync triggered for ${syncType}`,
		syncType,
	});
}
