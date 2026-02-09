import type { GenericQueryCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import type { MemberRole } from "../validators";

/** Roles that can perform operational actions (trigger syncs, manage mappings/schedules). */
const OPERATOR_ROLES: MemberRole[] = ["member", "admin", "owner"];

/** Roles with administrative privileges (manage members, credentials, org settings). */
const ADMIN_ROLES: MemberRole[] = ["admin", "owner"];

/** Roles that can manage billing (future). */
const BILLING_ROLES: MemberRole[] = ["billing", "admin", "owner"];

/**
 * Verify the caller is authenticated and return their identity.
 * Throws if no valid auth token is present.
 */
export async function requireAuth(ctx: { auth: GenericQueryCtx<DataModel>["auth"] }) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthenticated: you must be logged in to perform this action.");
	}
	return identity;
}

/**
 * Look up the Convex user record for the authenticated caller.
 * Returns null if not found (user hasn't been JIT-provisioned yet).
 */
export async function getCurrentUser(ctx: {
	auth: GenericQueryCtx<DataModel>["auth"];
	db: GenericQueryCtx<DataModel>["db"];
}) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) return null;

	return await ctx.db
		.query("users")
		.withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
		.unique();
}

/**
 * Look up the Convex user record for the authenticated caller, or throw.
 */
export async function getCurrentUserOrThrow(ctx: {
	auth: GenericQueryCtx<DataModel>["auth"];
	db: GenericQueryCtx<DataModel>["db"];
}) {
	const user = await getCurrentUser(ctx);
	if (!user) {
		throw new Error("User record not found. Please reload the page.");
	}
	return user;
}

/**
 * Verify the caller is authenticated AND is a member of the specified organization.
 * Any role (including viewer and billing) passes this check.
 * Returns { identity, user, membership } on success.
 */
export async function requireOrgMembership(
	ctx: { auth: GenericQueryCtx<DataModel>["auth"]; db: GenericQueryCtx<DataModel>["db"] },
	organizationId: Id<"organizations">,
) {
	const identity = await requireAuth(ctx);
	const user = await getCurrentUserOrThrow(ctx);

	const membership = await ctx.db
		.query("memberships")
		.withIndex("by_org_and_user", (q) =>
			q.eq("organizationId", organizationId).eq("userId", user._id),
		)
		.unique();

	if (!membership) {
		throw new Error("Forbidden: you are not a member of this organization.");
	}

	return { identity, user, membership };
}

/**
 * Verify the caller has an operational role (member, admin, or owner).
 * Blocks viewer and billing roles from performing sync/write operations.
 * Returns { identity, user, membership } on success.
 */
export async function requireOrgOperator(
	ctx: { auth: GenericQueryCtx<DataModel>["auth"]; db: GenericQueryCtx<DataModel>["db"] },
	organizationId: Id<"organizations">,
) {
	const { identity, user, membership } = await requireOrgMembership(ctx, organizationId);

	if (!OPERATOR_ROLES.includes(membership.role)) {
		throw new Error("Forbidden: you need at least member-level access to perform this action.");
	}

	return { identity, user, membership };
}

/**
 * Verify the caller is an admin (or owner) of the specified organization.
 * Returns { identity, user, membership } on success.
 */
export async function requireOrgAdmin(
	ctx: { auth: GenericQueryCtx<DataModel>["auth"]; db: GenericQueryCtx<DataModel>["db"] },
	organizationId: Id<"organizations">,
) {
	const { identity, user, membership } = await requireOrgMembership(ctx, organizationId);

	if (!ADMIN_ROLES.includes(membership.role)) {
		throw new Error("Forbidden: you must be an admin of this organization.");
	}

	return { identity, user, membership };
}

/**
 * Verify the caller can manage billing (billing, admin, or owner).
 * Returns { identity, user, membership } on success.
 */
export async function requireOrgBilling(
	ctx: { auth: GenericQueryCtx<DataModel>["auth"]; db: GenericQueryCtx<DataModel>["db"] },
	organizationId: Id<"organizations">,
) {
	const { identity, user, membership } = await requireOrgMembership(ctx, organizationId);

	if (!BILLING_ROLES.includes(membership.role)) {
		throw new Error("Forbidden: you need billing access to perform this action.");
	}

	return { identity, user, membership };
}

/**
 * Extract the Auth0 user ID (subject) from a Convex tokenIdentifier.
 * Format: "https://domain/|auth0|user123" → "auth0|user123"
 */
export function extractAuth0UserId(tokenIdentifier: string): string {
	const firstPipe = tokenIdentifier.indexOf("|");
	if (firstPipe === -1) {
		throw new Error(`Invalid tokenIdentifier format: ${tokenIdentifier}`);
	}
	return tokenIdentifier.substring(firstPipe + 1);
}
