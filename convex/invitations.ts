import { v } from "convex/values";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { ensureAuth0RoleIds } from "./auth0RoleMappings";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { extractAuth0UserId, requireOrgAdmin, requireOrgMembership } from "./lib/auth";
import {
	addAuth0OrgMember,
	assignAuth0OrgRoles,
	createAuth0OrganizationInvitation,
	deleteAuth0OrganizationInvitation,
} from "./lib/auth0Management";
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

		// Schedule Auth0 invitation send (Auth0 sends the email with its own invite link).
		// Best-effort: if the org has no auth0OrgId, the action will skip.
		await ctx.scheduler.runAfter(0, internal.invitations.sendInvitationViaAuth0, {
			invitationId,
			organizationId: args.organizationId,
			inviteeEmail: args.email,
			inviterName: ctx.user.name ?? ctx.user.email,
			role: args.role,
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

		// If the invitation was sent via Auth0, revoke it there too so the link stops working.
		if (invitation.auth0InvitationId) {
			await ctx.scheduler.runAfter(0, internal.invitations.revokeInvitationInAuth0, {
				organizationId: invitation.organizationId,
				auth0InvitationId: invitation.auth0InvitationId,
			});
		}
	},
});

// ---------------------------------------------------------------------------
// Internal: Sync org membership from Auth0 (Option 5A)
// ---------------------------------------------------------------------------

/**
 * Called from the Auth0 Post-Login HTTP Action when `event.organization` is present.
 *
 * When Auth0 reports that a user logged in with an organization context
 * (e.g. after accepting an Auth0 Organization Invitation), this mutation:
 * 1. Resolves the Convex org by auth0OrgId.
 * 2. Resolves the Convex user by tokenIdentifier.
 * 3. If no membership exists, creates one using the role from the pending
 *    invitation (or defaults to "member").
 * 4. If a pending invitation exists for this email + org, marks it accepted.
 */
export const syncOrgMembershipFromAuth0 = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		email: v.string(),
		auth0OrgId: v.string(),
	},
	handler: async (ctx, args) => {
		// 1. Resolve org
		const org = await ctx.db
			.query("organizations")
			.withIndex("by_auth0OrgId", (q) => q.eq("auth0OrgId", args.auth0OrgId))
			.unique();

		if (!org) {
			// Auth0 org not linked to any Convex org — nothing to sync
			return;
		}

		// 2. Resolve user
		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
			.unique();

		if (!user) {
			// User not provisioned yet — this shouldn't happen since upsert runs first
			return;
		}

		// 3. Check for existing membership
		const existingMembership = await ctx.db
			.query("memberships")
			.withIndex("by_org_and_user", (q) => q.eq("organizationId", org._id).eq("userId", user._id))
			.unique();

		// 4. Find a pending invitation for this email + org
		const pendingInvitation = await ctx.db
			.query("invitations")
			.withIndex("by_org_and_email", (q) => q.eq("organizationId", org._id).eq("email", args.email))
			.filter((q) => q.eq(q.field("status"), "pending"))
			.first();

		if (!existingMembership) {
			// Create membership with the role from the invitation (or default to "member")
			const role = pendingInvitation?.role ?? "member";
			await ctx.db.insert("memberships", {
				organizationId: org._id,
				userId: user._id,
				role,
				joinedAt: Date.now(),
			});
		}

		// 5. Mark the invitation as accepted (if one existed)
		if (pendingInvitation) {
			await ctx.db.patch(pendingInvitation._id, {
				status: "accepted",
				acceptedAt: Date.now(),
			});
		}
	},
});

// ---------------------------------------------------------------------------
// Internal: Auth0 invitation send
// ---------------------------------------------------------------------------

/**
 * Send an invitation via Auth0 Organization Invitations API.
 * Auth0 generates the invite link/token and sends the email.
 * On success, patches the Convex invitation with the Auth0 invitation ID.
 */
export const sendInvitationViaAuth0 = internalAction({
	args: {
		invitationId: v.id("invitations"),
		organizationId: v.id("organizations"),
		inviteeEmail: v.string(),
		inviterName: v.string(),
		role: memberRole,
	},
	handler: async (ctx, args) => {
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		if (!org?.auth0OrgId) {
			// No Auth0 org linked — skip sending via Auth0
			console.warn(
				`Skipping Auth0 invitation send: organization ${args.organizationId} has no auth0OrgId`,
			);
			return;
		}

		const auth0AppClientId = process.env.AUTH0_APP_CLIENT_ID;
		if (!auth0AppClientId) {
			console.warn("Skipping Auth0 invitation send: AUTH0_APP_CLIENT_ID env var not configured");
			return;
		}

		// Resolve Convex role name → Auth0 role ID
		const roleIds = await ensureAuth0RoleIds(ctx, [args.role as MemberRole]);

		const connectionId = process.env.AUTH0_INVITATION_CONNECTION_ID;

		try {
			const auth0Invitation = await createAuth0OrganizationInvitation(org.auth0OrgId, {
				inviteeEmail: args.inviteeEmail,
				inviterName: args.inviterName,
				clientId: auth0AppClientId,
				connectionId: connectionId || undefined,
				roleIds,
				sendInvitationEmail: true,
			});

			// Store the Auth0 invitation ID on the Convex invitation for revocation/debugging.
			await ctx.runMutation(internal.invitations.patchAuth0InvitationId, {
				invitationId: args.invitationId,
				auth0InvitationId: auth0Invitation.id,
			});
		} catch (error) {
			console.error("Failed to send invitation via Auth0:", error);
			// The Convex invitation remains pending; admin can retry or revoke.
		}
	},
});

/**
 * Internal mutation to patch the auth0InvitationId on a Convex invitation.
 * Called from sendInvitationViaAuth0 action after successful Auth0 API call.
 */
export const patchAuth0InvitationId = internalMutation({
	args: {
		invitationId: v.id("invitations"),
		auth0InvitationId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.invitationId, {
			auth0InvitationId: args.auth0InvitationId,
		});
	},
});

// ---------------------------------------------------------------------------
// Internal: Auth0 invitation revocation
// ---------------------------------------------------------------------------

/**
 * Delete (revoke) an invitation in Auth0 so the invite link stops working.
 * Best-effort: logs errors but does not throw (Convex already revoked).
 */
export const revokeInvitationInAuth0 = internalAction({
	args: {
		organizationId: v.id("organizations"),
		auth0InvitationId: v.string(),
	},
	handler: async (ctx, args) => {
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		if (!org?.auth0OrgId) {
			return;
		}

		try {
			await deleteAuth0OrganizationInvitation(org.auth0OrgId, args.auth0InvitationId);
		} catch (error) {
			console.error("Failed to revoke invitation in Auth0:", error);
		}
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
