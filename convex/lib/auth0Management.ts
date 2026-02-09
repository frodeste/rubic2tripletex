/**
 * Auth0 Management API helpers.
 *
 * Convex is the source of truth for organization membership and roles.
 * These helpers sync changes to Auth0 via M2M (best-effort) so that
 * Auth0 Organizations and RBAC stay in sync for SSO / token-based access.
 *
 * Used to:
 * 1. Sync profile changes (e.g. name) back to Auth0
 * 2. Create / update Auth0 Organizations when orgs are created in Convex
 * 3. Manage organization membership and role assignments (Auth0 RBAC)
 * 4. Auto-create Auth0 roles on demand (cached in Convex `auth0RoleMappings` table)
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
 *   - create:roles
 *   - create:organizations
 *   - read:organizations
 *   - update:organizations
 *   - read:organization_members
 *   - create:organization_members
 *   - delete:organization_members
 *   - read:organization_member_roles
 *   - create:organization_member_roles
 *   - delete:organization_member_roles
 *   - create:organization_invitations
 *   - read:organization_invitations
 *   - delete:organization_invitations
 *
 * @see https://auth0.com/docs/api/management/v2
 */

// No Convex-specific imports — this module contains pure HTTP helpers only.
// Role resolution (name → Auth0 ID) lives in convex/auth0RoleMappings.ts.

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
 * Paginates automatically so every role is returned regardless of
 * how many roles exist (Auth0 max per_page is 100).
 */
export async function listAuth0Roles(): Promise<Auth0Role[]> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const allRoles: Auth0Role[] = [];
	const perPage = 100;
	let page = 0;

	while (true) {
		const url = `${config.domain}/api/v2/roles?per_page=${perPage}&page=${page}&include_totals=true`;
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Auth0 list roles failed (${response.status}): ${body}`);
		}

		const data = (await response.json()) as { roles: Auth0Role[]; total: number };
		allRoles.push(...data.roles);

		// Stop when we've collected all roles
		if (allRoles.length >= data.total) {
			break;
		}
		page++;
	}

	return allRoles;
}

// ---------------------------------------------------------------------------
// Role management
// ---------------------------------------------------------------------------

/**
 * Create a role in Auth0 via the Management API.
 *
 * Called by `ensureAuth0RoleIds` when a Convex role has no corresponding
 * Auth0 role yet. Returns the newly created Auth0 role ID.
 */
export async function createAuth0Role(name: string, description?: string): Promise<string> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(`${config.domain}/api/v2/roles`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ name, description: description ?? `Auto-created role: ${name}` }),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 create role failed (${response.status}): ${body}`);
	}

	const data = (await response.json()) as { id: string };
	return data.id;
}

// ---------------------------------------------------------------------------
// Organization management
// ---------------------------------------------------------------------------

/**
 * Create an Auth0 Organization via the Management API.
 *
 * @param name        - Machine-friendly identifier (lowercase, hyphens, unique in Auth0)
 * @param displayName - Human-readable organization name
 * @returns The Auth0 Organization ID (e.g. "org_abc123")
 */
export async function createAuth0Organization(name: string, displayName: string): Promise<string> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(`${config.domain}/api/v2/organizations`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ name, display_name: displayName }),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 create organization failed (${response.status}): ${body}`);
	}

	const data = (await response.json()) as { id: string };
	return data.id;
}

/**
 * Update an Auth0 Organization via the Management API.
 *
 * @param auth0OrgId - The Auth0 Organization ID
 * @param updates    - Fields to patch (e.g. { display_name })
 */
export async function updateAuth0Organization(
	auth0OrgId: string,
	updates: { display_name?: string },
): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}`,
		{
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(updates),
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Auth0 update organization failed (${response.status}): ${body}`);
	}
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
 * Callers must resolve role names to Auth0 role IDs beforehand
 * via `ensureAuth0RoleIds()` from `convex/auth0RoleMappings.ts`.
 *
 * @param auth0OrgId  - The Auth0 Organization ID
 * @param auth0UserId - The Auth0 user ID
 * @param roleIds     - Pre-resolved Auth0 role IDs to assign
 */
export async function assignAuth0OrgRoles(
	auth0OrgId: string,
	auth0UserId: string,
	roleIds: string[],
): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

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
 * Callers must resolve role names to Auth0 role IDs beforehand
 * via `ensureAuth0RoleIds()` from `convex/auth0RoleMappings.ts`.
 *
 * @param auth0OrgId  - The Auth0 Organization ID
 * @param auth0UserId - The Auth0 user ID
 * @param roleIds     - Pre-resolved Auth0 role IDs to remove
 */
export async function removeAuth0OrgRoles(
	auth0OrgId: string,
	auth0UserId: string,
	roleIds: string[],
): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

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

// ---------------------------------------------------------------------------
// Organization Invitations (Auth0-managed)
// ---------------------------------------------------------------------------

interface CreateAuth0InvitationOptions {
	/** Email address of the invitee. */
	inviteeEmail: string;
	/** Display name of the inviter (shown in the invitation email). */
	inviterName: string;
	/** The Auth0 Application client ID the invitee should authenticate with. */
	clientId: string;
	/** The Auth0 Connection ID the invitee should authenticate through (optional). */
	connectionId?: string;
	/** Time-to-live in seconds. Defaults to 604800 (7 days) if omitted. Max 2592000 (30 days). */
	ttlSec?: number;
	/** Pre-resolved Auth0 role IDs to assign on acceptance (optional, max 50). */
	roleIds?: string[];
	/** Whether Auth0 should send the invitation email. Defaults to true. */
	sendInvitationEmail?: boolean;
}

interface Auth0InvitationResponse {
	id: string;
	invitation_url: string;
	created_at: string;
	expires_at: string;
}

/**
 * Create an Organization Invitation via the Auth0 Management API.
 *
 * Auth0 generates the invite link and (optionally) sends the invitation email.
 * Returns the Auth0 invitation ID and URL.
 *
 * Requires M2M scope `create:organization_invitations`.
 *
 * @param auth0OrgId - The Auth0 Organization ID (e.g. "org_abc123")
 * @param options    - Invitation details (invitee email, inviter name, client ID, etc.)
 * @returns The Auth0 invitation response containing the invitation ID and URL.
 *
 * @see https://auth0.com/docs/manage-users/organizations/configure-organizations/send-membership-invitations
 */
export async function createAuth0OrganizationInvitation(
	auth0OrgId: string,
	options: CreateAuth0InvitationOptions,
): Promise<Auth0InvitationResponse> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const body: Record<string, unknown> = {
		inviter: { name: options.inviterName },
		invitee: { email: options.inviteeEmail },
		client_id: options.clientId,
		send_invitation_email: options.sendInvitationEmail ?? true,
	};

	if (options.connectionId) {
		body.connection_id = options.connectionId;
	}
	if (options.ttlSec !== undefined) {
		body.ttl_sec = options.ttlSec;
	}
	if (options.roleIds && options.roleIds.length > 0) {
		body.roles = options.roleIds;
	}

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}/invitations`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		const responseBody = await response.text();
		throw new Error(
			`Auth0 create organization invitation failed (${response.status}): ${responseBody}`,
		);
	}

	return (await response.json()) as Auth0InvitationResponse;
}

/**
 * Delete (revoke) an Organization Invitation via the Auth0 Management API.
 *
 * Once deleted, the invitation link stops working.
 *
 * Requires M2M scope `delete:organization_invitations`.
 *
 * @param auth0OrgId        - The Auth0 Organization ID
 * @param auth0InvitationId - The Auth0 Invitation ID to delete
 */
export async function deleteAuth0OrganizationInvitation(
	auth0OrgId: string,
	auth0InvitationId: string,
): Promise<void> {
	const config = requireAuth0Config();
	const token = await getManagementToken(config);

	const response = await fetch(
		`${config.domain}/api/v2/organizations/${encodeURIComponent(auth0OrgId)}/invitations/${encodeURIComponent(auth0InvitationId)}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		},
	);

	if (!response.ok) {
		const responseBody = await response.text();
		throw new Error(
			`Auth0 delete organization invitation failed (${response.status}): ${responseBody}`,
		);
	}
}
