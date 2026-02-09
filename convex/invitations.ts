import { v } from "convex/values";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { ensureAuth0RoleIds } from "./auth0RoleMappings";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { extractAuth0UserId, requireOrgAdmin, requireOrgMembership } from "./lib/auth";
import { addAuth0OrgMember, assignAuth0OrgRoles } from "./lib/auth0Management";
import type { MemberRole } from "./validators";
import { memberRole } from "./validators";

/**
 * Create a new invitation for an organization.
 * Requires admin or owner role.
 */
export const create = authenticatedMutation({
	args: {
		organizationId: v.id("organizations"),
		email: v.string(),
		role: memberRole,
	},
	handler: async (ctx, args) => {
		const { membership: callerMembership } = await requireOrgAdmin(ctx, args.organizationId);

		if (args.role === "owner" && callerMembership.role !== "owner") {
			throw new Error("Only owners can invite other owners.");
		}

		// Check for existing pending invitation
		const existingInvitation = await ctx.db
			.query("invitations")
			.withIndex("by_org_and_email", (q) =>
				q.eq("organizationId", args.organizationId).eq("email", args.email),
			)
			.filter((q) => q.eq(q.field("status"), "pending"))
			.first();

		if (existingInvitation) {
			throw new Error("A pending invitation already exists for this email.");
		}

		// Check if user is already a member
		const invitedUser = await ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", args.email))
			.unique();

		if (invitedUser) {
			const existingMembership = await ctx.db
				.query("memberships")
				.withIndex("by_org_and_user", (q) =>
					q.eq("organizationId", args.organizationId).eq("userId", invitedUser._id),
				)
				.unique();

			if (existingMembership) {
				throw new Error("User is already a member of this organization.");
			}
		}

		// Generate token and expiration
		const token = crypto.randomUUID();
		const expiresAt = Date.now() + SEVEN_DAYS_IN_MS;

		// Create invitation
		const invitationId = await ctx.db.insert("invitations", {
			organizationId: args.organizationId,
			email: args.email,
			role: args.role,
			invitedBy: ctx.user._id,
			token,
			expiresAt,
			status: "pending",
			createdAt: Date.now(),
		});

		return invitationId;
	},
});

/**
 * List all invitations for an organization.
 * Requires membership in the organization.
 */
export const listForOrg = authenticatedQuery({
	args: {
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		const invitations = await ctx.db
			.query("invitations")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();

		return invitations;
	},
});

/**
 * Accept an invitation by token.
 * Creates a membership in Convex, then syncs to Auth0 (best-effort).
 */
export const accept = authenticatedMutation({
	args: {
		token: v.string(),
	},
	handler: async (ctx, args) => {
		// Look up invitation by token
		const invitation = await ctx.db
			.query("invitations")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.unique();

		if (!invitation) {
			throw new Error("Invitation not found");
		}

		if (invitation.status !== "pending") {
			throw new Error("Invitation is no longer valid");
		}

		// Verify the accepting user matches the invited email
		if (ctx.user.email !== invitation.email) {
			throw new Error("This invitation was sent to a different email address.");
		}

		// Check expiration
		if (invitation.expiresAt < Date.now()) {
			await ctx.db.patch(invitation._id, {
				status: "expired",
			});
			throw new Error("Invitation has expired");
		}

		// Check if user is already a member
		const existingMembership = await ctx.db
			.query("memberships")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", invitation.organizationId).eq("userId", ctx.user._id),
			)
			.unique();

		if (!existingMembership) {
			// Create membership in Convex
			await ctx.db.insert("memberships", {
				organizationId: invitation.organizationId,
				userId: ctx.user._id,
				role: invitation.role,
				joinedAt: Date.now(),
			});

			// Schedule Auth0 sync (best-effort, runs as a separate action)
			await ctx.scheduler.runAfter(0, internal.invitations.syncAcceptedMemberToAuth0, {
				organizationId: invitation.organizationId,
				userId: ctx.user._id,
				role: invitation.role,
			});
		}

		// Update invitation status
		await ctx.db.patch(invitation._id, {
			status: "accepted",
			acceptedAt: Date.now(),
		});

		return invitation.organizationId;
	},
});

/**
 * Revoke a pending invitation.
 * Requires admin or owner role.
 */
export const revoke = authenticatedMutation({
	args: {
		invitationId: v.id("invitations"),
	},
	handler: async (ctx, args) => {
		const invitation = await ctx.db.get(args.invitationId);

		if (!invitation) {
			throw new Error("Invitation not found");
		}

		await requireOrgAdmin(ctx, invitation.organizationId);

		if (invitation.status !== "pending") {
			throw new Error("Can only revoke pending invitations");
		}

		await ctx.db.patch(args.invitationId, {
			status: "revoked",
		});
	},
});

// ---------------------------------------------------------------------------
// Internal: Auth0 sync for accepted invitations
// ---------------------------------------------------------------------------

/**
 * Sync a newly accepted membership to Auth0 Organization.
 * This runs as a scheduled action after the invitation is accepted,
 * so the mutation completes immediately and Auth0 sync is best-effort.
 */
export const syncAcceptedMemberToAuth0 = internalAction({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		role: memberRole,
	},
	handler: async (ctx, args) => {
		const user = await ctx.runQuery(internal.organizations.getUserById, {
			userId: args.userId,
		});
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		if (!user || !org?.auth0OrgId) {
			// No Auth0 org linked — skip sync
			return;
		}

		const auth0UserId = extractAuth0UserId(user.tokenIdentifier);

		try {
			await addAuth0OrgMember(org.auth0OrgId, auth0UserId);
			const roleIds = await ensureAuth0RoleIds(ctx, [args.role as MemberRole]);
			await assignAuth0OrgRoles(org.auth0OrgId, auth0UserId, roleIds);
		} catch (error) {
			console.error("Failed to sync accepted invitation to Auth0:", error);
		}
	},
});
