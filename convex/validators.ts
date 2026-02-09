import { v } from "convex/values";

// --- Enum-like validators ---

export const syncType = v.union(
	v.literal("customers"),
	v.literal("products"),
	v.literal("invoices"),
	v.literal("payments"),
);

export const syncStatus = v.union(v.literal("running"), v.literal("success"), v.literal("failed"));

export const tripletexEnv = v.union(v.literal("sandbox"), v.literal("production"));

export const providerType = v.union(v.literal("rubic"), v.literal("tripletex"));

export const memberRole = v.union(
	v.literal("owner"),
	v.literal("admin"),
	v.literal("member"),
	v.literal("billing"),
	v.literal("viewer"),
);

// --- Type exports ---

export type SyncType = "customers" | "products" | "invoices" | "payments";
export type SyncStatus = "running" | "success" | "failed";
export type TripletexEnv = "sandbox" | "production";
export type ProviderType = "rubic" | "tripletex";
export type MemberRole = "owner" | "admin" | "member" | "billing" | "viewer";

/**
 * Role hierarchy for permission checks.
 * Higher number = more privileges in the operational hierarchy.
 * billing is lateral (separate permission scope, not in the main hierarchy).
 */
export const ROLE_HIERARCHY: Record<MemberRole, number> = {
	viewer: 0,
	billing: 0,
	member: 1,
	admin: 2,
	owner: 3,
};
