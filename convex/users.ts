import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { updateAuth0User } from "./lib/auth0Management";

/**
 * Internal mutation called by the Auth0 Post-Login HTTP Action.
 * Upserts a user record by tokenIdentifier. Not exposed to the client.
 */
export const upsertFromAuth0 = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		email: v.string(),
		name: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
			.unique();

		const now = Date.now();

		if (existingUser) {
			// Only update lastActiveAt, name, and avatarUrl on subsequent logins
			await ctx.db.patch(existingUser._id, {
				lastActiveAt: now,
				...(args.name !== undefined ? { name: args.name } : {}),
				...(args.avatarUrl !== undefined ? { avatarUrl: args.avatarUrl } : {}),
			});
			return existingUser._id;
		}

		// Create new user
		const userId = await ctx.db.insert("users", {
			tokenIdentifier: args.tokenIdentifier,
			email: args.email,
			name: args.name,
			avatarUrl: args.avatarUrl,
			lastActiveAt: now,
			createdAt: now,
		});

		return userId;
	},
});

/**
 * Store or update the current user's record in Convex.
 * This is a raw mutation (not authenticatedMutation) because it creates
 * the user record that authenticatedMutation depends on.
 */
export const store = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated: you must be logged in.");
		}

		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
			.unique();

		const now = Date.now();

		if (existingUser) {
			// Only update lastActiveAt on subsequent logins.
			// Don't overwrite name/avatar — the user may have customised
			// them via the profile page (Convex is SoT for app-level profile).
			await ctx.db.patch(existingUser._id, { lastActiveAt: now });
			return existingUser._id;
		}

		// Create new user
		const userId = await ctx.db.insert("users", {
			tokenIdentifier: identity.tokenIdentifier,
			email: identity.email ?? "",
			name: identity.name ?? undefined,
			avatarUrl: identity.pictureUrl ?? undefined,
			lastActiveAt: now,
			createdAt: now,
		});

		return userId;
	},
});

/**
 * Get the current user record, or null if not authenticated or not stored yet.
 * This is a raw query (not authenticatedQuery) because it must return null
 * when the user hasn't been stored yet.
 */
export const current = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
			.unique();

		return user;
	},
});

/**
 * Get the current authenticated user.
 * Uses authenticatedQuery, so ctx.user is already injected.
 */
export const me = authenticatedQuery({
	args: {},
	handler: async (ctx) => {
		return ctx.user;
	},
});

/**
 * Internal mutation to patch user profile data in Convex.
 * Called from the `updateProfile` action after authentication.
 */
export const updateProfileData = internalMutation({
	args: {
		userId: v.id("users"),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, string | undefined> = {};

		if (args.name !== undefined) updates.name = args.name || undefined;
		if (args.phone !== undefined) updates.phone = args.phone || undefined;
		if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl || undefined;

		if (Object.keys(updates).length > 0) {
			await ctx.db.patch(args.userId, updates);
		}
	},
});

/**
 * Update the current user's profile information.
 * Updates Convex (SoT) first, then syncs the name to Auth0 so the
 * identity provider stays consistent.
 */
export const updateProfile = action({
	args: {
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated: you must be logged in.");
		}

		const user = await ctx.runQuery(api.users.current, {});
		if (!user) {
			throw new Error("User record not found. Please reload the page.");
		}

		// 1. Update Convex — the single source of truth for app-level profile data
		await ctx.runMutation(internal.users.updateProfileData, {
			userId: user._id,
			name: args.name,
			phone: args.phone,
			avatarUrl: args.avatarUrl,
		});

		// 2. Sync name back to Auth0 so the identity provider stays in sync
		if (args.name !== undefined) {
			try {
				await updateAuth0User(identity.subject, {
					name: args.name.trim() || undefined,
				});
			} catch (error) {
				// Log but don't fail — Convex is SoT, Auth0 sync is best-effort
				console.error("Failed to sync name to Auth0:", error);
			}
		}
	},
});

/**
 * Update the current user's preferences.
 */
export const updatePreferences = authenticatedMutation({
	args: {
		preferences: v.object({
			defaultOrgId: v.optional(v.id("organizations")),
		}),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(ctx.user._id, {
			preferences: args.preferences,
		});
	},
});
