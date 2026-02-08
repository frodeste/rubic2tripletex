import type { GenericQueryCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

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
 * Verify the caller is authenticated AND is a member of the specified organization.
 * Returns { identity, membership } on success.
 */
export async function requireOrgMembership(
	ctx: { auth: GenericQueryCtx<DataModel>["auth"]; db: GenericQueryCtx<DataModel>["db"] },
	organizationId: string,
) {
	const identity = await requireAuth(ctx);
	const auth0UserId = identity.subject; // Auth0 `sub` claim

	const membership = await ctx.db
		.query("organizationMembers")
		.withIndex("by_org_and_user", (q: any) =>
			q.eq("organizationId", organizationId).eq("auth0UserId", auth0UserId),
		)
		.unique();

	if (!membership) {
		throw new Error("Forbidden: you are not a member of this organization.");
	}

	return { identity, membership };
}

/**
 * Verify the caller is an admin of the specified organization.
 * Returns { identity, membership } on success.
 */
export async function requireOrgAdmin(
	ctx: { auth: GenericQueryCtx<DataModel>["auth"]; db: GenericQueryCtx<DataModel>["db"] },
	organizationId: string,
) {
	const { identity, membership } = await requireOrgMembership(ctx, organizationId);

	if (membership.role !== "admin") {
		throw new Error("Forbidden: you must be an admin of this organization.");
	}

	return { identity, membership };
}
