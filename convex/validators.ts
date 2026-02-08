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

export const memberRole = v.union(v.literal("admin"), v.literal("member"));

// --- Type exports ---

export type SyncType = "customers" | "products" | "invoices" | "payments";
export type SyncStatus = "running" | "success" | "failed";
export type TripletexEnv = "sandbox" | "production";
export type ProviderType = "rubic" | "tripletex";
export type MemberRole = "admin" | "member";
