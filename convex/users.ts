import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";

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
			// Update existing user
			const updates: {
				lastActiveAt: number;
				name?: string;
			} = {
				lastActiveAt: now,
			};

			// Update name if it differs
			if (identity.name && identity.name !== existingUser.name) {
				updates.name = identity.name;
			}

			await ctx.db.patch(existingUser._id, updates);
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
