import type { GenericQueryCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";

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
 * Verify the caller is an admin (or owner) of the specified organization.
 * Returns { identity, user, membership } on success.
 */
export async function requireOrgAdmin(
	ctx: { auth: GenericQueryCtx<DataModel>["auth"]; db: GenericQueryCtx<DataModel>["db"] },
	organizationId: Id<"organizations">,
) {
	const { identity, user, membership } = await requireOrgMembership(ctx, organizationId);

	if (membership.role !== "admin" && membership.role !== "owner") {
		throw new Error("Forbidden: you must be an admin of this organization.");
	}

	return { identity, user, membership };
}
