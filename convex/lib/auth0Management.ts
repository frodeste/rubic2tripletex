/**
 * Auth0 Management API helpers.
 *
 * Used to:
 * 1. Sync profile changes (e.g. name) back to Auth0
 * 2. Manage organization membership and role assignments (Auth0 RBAC)
 *
 * Auth0 is the source of truth for role assignments. Convex memberships
 * are kept as a synced cache for fast backend queries.
 *
 * Requires Machine-to-Machine (M2M) credentials set as Convex
 * environment variables:
 *   - AUTH0_DOMAIN            (e.g. "https://your-tenant.eu.auth0.com")
 *   - AUTH0_M2M_CLIENT_ID
 *   - AUTH0_M2M_CLIENT_SECRET
 *
 * The M2M application must be authorized for the Auth0 Management API
 * with at least these scopes:
 *   - update:users
 *   - read:roles
 *   - read:organization_members
 *   - create:organization_members
 *   - delete:organization_members
 *   - read:organization_member_roles
 *   - create:organization_member_roles
 *   - delete:organization_member_roles
 *
 * @see https://auth0.com/docs/api/management/v2
 */

import type { MemberRole } from "../validators";

interface Auth0Config {
	domain: string;
	clientId: string;
	clientSecret: string;
}

interface Auth0Role {
	id: string;
	name: string;
	description?: string;
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
 * Get the Auth0 config or throw. Use when Auth0 integration is required
 * (not optional/graceful degradation).
 */
function requireAuth0Config(): Auth0Config {
	const config = getAuth0Config();
	if (!config) {
		throw new Error(
			"Auth0 M2M credentials not configured. Set AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, and AUTH0_M2M_CLIENT_SECRET.",
		);
	}
	return config;
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

// ---------------------------------------------------------------------------
// User profile management
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Organization role management (Auth0 RBAC)
// ---------------------------------------------------------------------------

/**
 * List all roles defined in the Auth0 tenant.
 * Used to resolve role names (e.g. "admin") to Auth0 role IDs.
 */
export async function listAuth0Roles(): Promise<Auth0Role[]> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(`${config.domain}/api/v2/roles?per_page=50`, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 list roles failed (${response.status}): ${body}`);
	}

	return (await response.json()) as Auth0Role[];
}

/**
 * Resolve an application role name to an Auth0 role ID.
 * Throws if the role doesn't exist in Auth0 — roles must be
 * pre-created in the Auth0 Dashboard.
 */
async function resolveRoleId(roleName: MemberRole): Promise<string> {
	const roles = await listAuth0Roles();
	const match = roles.find((r) => r.name === roleName);
	if (!match) {
		throw new Error(
			`Auth0 role "${roleName}" not found. Create it in the Auth0 Dashboard under User Management > Roles.`,
		);
	}
	return match.id;
}

/**
 * Add a user to an Auth0 Organization.
 *
 * @param auth0OrgId  - The Auth0 Organization ID (e.g. "org_abc123")
 * @param auth0UserId - The Auth0 user ID (e.g. "auth0|abc123")
 */
export async function addAuth0OrgMember(auth0OrgId: string, auth0UserId: string): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}/members`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ members: [auth0UserId] }),
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 add org member failed (${response.status}): ${body}`);
	}
}

/**
 * Remove a user from an Auth0 Organization.
 *
 * @param auth0OrgId  - The Auth0 Organization ID
 * @param auth0UserId - The Auth0 user ID
 */
export async function removeAuth0OrgMember(auth0OrgId: string, auth0UserId: string): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}/members`,
		{
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ members: [auth0UserId] }),
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 remove org member failed (${response.status}): ${body}`);
	}
}

/**
 * Assign roles to a user within an Auth0 Organization.
 *
 * @param auth0OrgId  - The Auth0 Organization ID
 * @param auth0UserId - The Auth0 user ID
 * @param roleNames   - Application role names to assign (e.g. ["admin"])
 */
export async function assignAuth0OrgRoles(
	auth0OrgId: string,
	auth0UserId: string,
	roleNames: MemberRole[],
): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	// Resolve role names to Auth0 role IDs
	const roleIds = await Promise.all(roleNames.map(resolveRoleId));

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}/members/${encodeURIComponent(auth0UserId)}/roles`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ roles: roleIds }),
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 assign org roles failed (${response.status}): ${body}`);
	}
}

/**
 * Remove roles from a user within an Auth0 Organization.
 *
 * @param auth0OrgId  - The Auth0 Organization ID
 * @param auth0UserId - The Auth0 user ID
 * @param roleNames   - Application role names to remove
 */
export async function removeAuth0OrgRoles(
	auth0OrgId: string,
	auth0UserId: string,
	roleNames: MemberRole[],
): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const roleIds = await Promise.all(roleNames.map(resolveRoleId));

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}/members/${encodeURIComponent(auth0UserId)}/roles`,
		{
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ roles: roleIds }),
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 remove org roles failed (${response.status}): ${body}`);
	}
}

/**
 * Get the roles assigned to a user within an Auth0 Organization.
 *
 * @param auth0OrgId  - The Auth0 Organization ID
 * @param auth0UserId - The Auth0 user ID
 * @returns Array of Auth0 role objects with id, name, description
 */
export async function getAuth0OrgMemberRoles(
	auth0OrgId: string,
	auth0UserId: string,
): Promise<Auth0Role[]> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}/members/${encodeURIComponent(auth0UserId)}/roles`,
		{
			headers: { Authorization: `Bearer ${token}` },
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 get org member roles failed (${response.status}): ${body}`);
	}

	return (await response.json()) as Auth0Role[];
}
