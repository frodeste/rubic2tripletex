/**
 * Convex auth configuration — tells Convex which identity providers to trust.
 *
 * Convex verifies JWTs against the configured Auth0 domain so that
 * `ctx.auth.getUserIdentity()` returns the caller's identity in
 * queries, mutations, and actions.
 *
 * Prerequisites:
 *  1. Create an API in Auth0 → APIs with identifier (audience) matching
 *     your Convex deployment URL (e.g. "https://friendly-finch-466.eu-west-1.convex.cloud").
 *  2. Set CONVEX_AUTH0_DOMAIN and CONVEX_AUTH0_CLIENT_ID in the Convex dashboard
 *     environment variables (or rely on the hardcoded defaults below for dev).
 */
export default {
	providers: [
		{
			domain: process.env.AUTH0_DOMAIN ?? "https://uniteperformance.eu.auth0.com",
			applicationID: process.env.AUTH0_CLIENT_ID ?? "W3rtgX1JwqOhfLXTeLQf6eVcDK26kbgl",
		},
	],
};
