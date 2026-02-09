import { auth0 } from "@/auth0";

/**
 * Returns the Auth0 ID token for the current session.
 *
 * The Convex client calls this endpoint to authenticate with Convex,
 * which verifies the JWT against the Auth0 issuer configured in
 * convex/auth.config.ts.
 *
 * We call `getAccessToken()` first to trigger automatic token refresh
 * when the current tokens are expired and a refresh token is available.
 * Auth0 v4 includes `offline_access` in the default scope, so refresh
 * tokens are always issued. After the refresh, the session contains a
 * fresh ID token that Convex will accept.
 */
export async function GET() {
	try {
		// Trigger automatic token refresh if current tokens are expired.
		// This is a no-op when tokens are still valid.
		await auth0.getAccessToken();

		const session = await auth0.getSession();
		if (!session?.tokenSet?.idToken) {
			return new Response(null, { status: 401 });
		}
		return Response.json({ token: session.tokenSet.idToken });
	} catch {
		return new Response(null, { status: 401 });
	}
}
