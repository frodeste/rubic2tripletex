"use node";

/**
 * Public action wrappers for sync operations.
 *
 * These are callable from the client and delegate to the internal sync
 * implementations after verifying the caller's authentication and role.
 *
 * Handlers are pre-typed with explicit `ActionCtx` to avoid TypeScript
 * TS2589 "Type instantiation is excessively deep" errors that occur when
 * the `action()` generic infers handler types through the large DataModel.
 */

import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { tripletexEnv as tripletexEnvValidator } from "./validators";

// ---------------------------------------------------------------------------
// Auth helpers (action-level — no ctx.db, uses ctx.runQuery)
// ---------------------------------------------------------------------------

/** Roles that can perform operational actions (trigger syncs, manage mappings/schedules). */
const OPERATOR_ROLES = ["member", "admin", "owner"];

/**
 * Verify the caller is authenticated and a member of the organization.
 * Works in action context (no ctx.db) by using ctx.runQuery.
 */
async function requireAuthAndMembership(
	ctx: Pick<GenericActionCtx<DataModel>, "auth" | "runQuery">,
	organizationId: Id<"organizations">,
) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthenticated: you must be logged in to perform this action.");
	}

	const user = await ctx.runQuery(api.users.current, {});
	if (!user) {
		throw new Error("User record not found. Please reload the page.");
	}

	const membership = await ctx.runQuery(internal.organizations.checkMembership, {
		organizationId,
		userId: user._id,
	});
	if (!membership) {
		throw new Error("Forbidden: you are not a member of this organization.");
	}
	return { identity, user, membership };
}

/**
 * Verify the caller is authenticated and has operator-level access.
 * Blocks viewer and billing roles from triggering sync operations.
 */
async function requireAuthAndOperator(
	ctx: Pick<GenericActionCtx<DataModel>, "auth" | "runQuery">,
	organizationId: Id<"organizations">,
) {
	const result = await requireAuthAndMembership(ctx, organizationId);
	if (!OPERATOR_ROLES.includes(result.membership.role)) {
		throw new Error("Forbidden: you need at least member-level access to perform this action.");
	}
	return result;
}

// ---------------------------------------------------------------------------
// Pre-typed handler argument interfaces
// ---------------------------------------------------------------------------

interface SyncArgs {
	organizationId: Id<"organizations">;
	tripletexEnv: "sandbox" | "production";
}

interface TestConnectionArgs {
	organizationId: Id<"organizations">;
	provider: "rubic" | "tripletex";
	environment: "sandbox" | "production";
}

interface OrgOnlyArgs {
	organizationId: Id<"organizations">;
}

// ---------------------------------------------------------------------------
// Pre-typed handlers (explicit ActionCtx avoids deep type inference in action())
// ---------------------------------------------------------------------------

const runCustomersHandler = async (ctx: ActionCtx, args: SyncArgs) => {
	await requireAuthAndOperator(ctx, args.organizationId);
	return ctx.runAction(internal.sync.runCustomers, args);
};

const runProductsHandler = async (ctx: ActionCtx, args: SyncArgs) => {
	await requireAuthAndOperator(ctx, args.organizationId);
	return ctx.runAction(internal.sync.runProducts, args);
};

const runInvoicesHandler = async (ctx: ActionCtx, args: SyncArgs) => {
	await requireAuthAndOperator(ctx, args.organizationId);
	return ctx.runAction(internal.sync.runInvoices, args);
};

const runPaymentsHandler = async (ctx: ActionCtx, args: SyncArgs) => {
	await requireAuthAndOperator(ctx, args.organizationId);
	return ctx.runAction(internal.sync.runPayments, args);
};

const testConnectionHandler = async (ctx: ActionCtx, args: TestConnectionArgs) => {
	await requireAuthAndOperator(ctx, args.organizationId);
	return ctx.runAction(internal.sync.testConnection, args);
};

const fetchDepartmentsFromRubicHandler = async (ctx: ActionCtx, args: OrgOnlyArgs) => {
	await requireAuthAndMembership(ctx, args.organizationId);
	return ctx.runAction(internal.sync.fetchDepartmentsFromRubic, args);
};

const fetchDepartmentsFromTripletexHandler = async (ctx: ActionCtx, args: SyncArgs) => {
	await requireAuthAndMembership(ctx, args.organizationId);
	return ctx.runAction(internal.sync.fetchDepartmentsFromTripletex, args);
};

// ---------------------------------------------------------------------------
// Public sync actions (require operator role)
// ---------------------------------------------------------------------------

const syncArgs = {
	organizationId: v.id("organizations"),
	tripletexEnv: tripletexEnvValidator,
};

export const runCustomersPublic = action({
	args: syncArgs,
	handler: runCustomersHandler,
});

export const runProductsPublic = action({
	args: syncArgs,
	handler: runProductsHandler,
});

export const runInvoicesPublic = action({
	args: syncArgs,
	handler: runInvoicesHandler,
});

export const runPaymentsPublic = action({
	args: syncArgs,
	handler: runPaymentsHandler,
});

export const testConnectionPublic = action({
	args: {
		organizationId: v.id("organizations"),
		provider: v.union(v.literal("rubic"), v.literal("tripletex")),
		environment: tripletexEnvValidator,
	},
	handler: testConnectionHandler,
});

// ---------------------------------------------------------------------------
// Public fetch actions (require membership — viewers can read)
// ---------------------------------------------------------------------------

export const fetchDepartmentsFromRubicPublic = action({
	args: { organizationId: v.id("organizations") },
	handler: fetchDepartmentsFromRubicHandler,
});

// @ts-ignore TS2589 — cumulative type instantiation depth from 7 action()
// registrations in one file exceeds TypeScript's limit. Handler is pre-typed
// with ActionCtx above, so runtime type safety is maintained.
export const fetchDepartmentsFromTripletexPublic = action({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnvValidator,
	},
	handler: fetchDepartmentsFromTripletexHandler,
});
