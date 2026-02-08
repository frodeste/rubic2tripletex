/**
 * Auth0 Management API helpers.
 *
 * Used to sync profile changes (e.g. name) back to Auth0 so the
 * identity provider stays consistent with the Convex source of truth.
 *
 * Requires Machine-to-Machine (M2M) credentials set as Convex
 * environment variables:
 *   - AUTH0_DOMAIN        (e.g. "https://your-tenant.eu.auth0.com")
 *   - AUTH0_M2M_CLIENT_ID
 *   - AUTH0_M2M_CLIENT_SECRET
 *
 * The M2M application must be authorized for the Auth0 Management API
 * with at least the `update:users` scope.
 *
 * @see https://auth0.com/docs/api/management/v2
 */

interface Auth0Config {
	domain: string;
	clientId: string;
	clientSecret: string;
}

/**
 * Read M2M credentials from environment variables.
 * Returns null when any required variable is missing, so callers
 * can gracefully skip the Auth0 sync.
 */
function getAuth0Config(): Auth0Config | null {
	const rawDomain = process.env.AUTH0_DOMAIN;
	const clientId = process.env.AUTH0_M2M_CLIENT_ID;
	const clientSecret = process.env.AUTH0_M2M_CLIENT_SECRET;

	if (!rawDomain || !clientId || !clientSecret) {
		return null;
	}

	// Normalize: accept both "uniteperformance.eu.auth0.com" and
	// "https://uniteperformance.eu.auth0.com" — always store with protocol.
	const domain = rawDomain.startsWith("https://") ? rawDomain : `https://${rawDomain}`;

	return { domain, clientId, clientSecret };
}

/**
 * Obtain a short-lived Management API access token via the
 * client-credentials grant.
 */
async function getManagementToken(config: Auth0Config): Promise<string> {
	const response = await fetch(`${config.domain}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			grant_type: "client_credentials",
			client_id: config.clientId,
			client_secret: config.clientSecret,
			audience: `${config.domain}/api/v2/`,
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 management token request failed (${response.status}): ${body}`);
	}

	const data = (await response.json()) as { access_token: string };
	return data.access_token;
}

/**
 * Update a user's profile in Auth0 via the Management API.
 *
 * Silently skips (with a console warning) when M2M credentials
 * are not configured, so the feature degrades gracefully in
 * development environments.
 *
 * @param auth0UserId - The Auth0 `sub` claim, e.g. "auth0|abc123"
 * @param updates     - Fields to patch on the Auth0 user object
 */
export async function updateAuth0User(
	auth0UserId: string,
	updates: { name?: string; picture?: string },
): Promise<void> {
	const config = getAuth0Config();
	if (!config) {
		console.warn("Auth0 M2M credentials not configured — skipping Auth0 profile sync");
		return;
	}

	const token = await getManagementToken(config);

	const response = await fetch(`${config.domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(updates),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 user update failed (${response.status}): ${body}`);
	}
}
