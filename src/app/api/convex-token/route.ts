import { auth0 } from "@/auth0";

/**
 * Returns the Auth0 ID token for the current session.
 * The Convex client calls this endpoint to authenticate with Convex,
 * which verifies the JWT against the Auth0 issuer configured in
 * convex/auth.config.ts.
 */
export async function GET() {
	try {
		const session = await auth0.getSession();
		if (!session?.tokenSet?.idToken) {
			return new Response(null, { status: 401 });
		}
		return Response.json({ token: session.tokenSet.idToken });
	} catch {
		return new Response(null, { status: 401 });
	}
}
