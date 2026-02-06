import type { NextRequest } from "next/server";
import { auth0 } from "@/auth0";

export async function proxy(request: NextRequest) {
	return auth0.middleware(request);
}

export const config = {
	matcher: [
		// Match auth routes
		"/api/auth/:path*",
		// Match protected pages (not API or static)
		"/((?!_next/static|_next/image|favicon.ico|api/cron|api/health).*)",
	],
};
