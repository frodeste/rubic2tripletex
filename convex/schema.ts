import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { memberRole, providerType, syncStatus, syncType, tripletexEnv } from "./validators";

export default defineSchema({
	// --- Users (JIT provisioned from Auth0) ---

	users: defineTable({
		tokenIdentifier: v.string(),
		email: v.string(),
		name: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
		preferences: v.optional(
			v.object({
				defaultOrgId: v.optional(v.id("organizations")),
			}),
		),
		lastActiveAt: v.number(),
		createdAt: v.number(),
	})
		.index("by_token", ["tokenIdentifier"])
		.index("by_email", ["email"]),

	// --- Multi-tenancy ---

	organizations: defineTable({
		name: v.string(),
		slug: v.string(),
		auth0OrgId: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_auth0OrgId", ["auth0OrgId"])
		.index("by_slug", ["slug"]),

	memberships: defineTable({
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		role: memberRole,
		joinedAt: v.number(),
	})
		.index("by_org", ["organizationId"])
		.index("by_user", ["userId"])
		.index("by_org_and_user", ["organizationId", "userId"]),

	// --- Invitations ---

	invitations: defineTable({
		organizationId: v.id("organizations"),
		email: v.string(),
		role: memberRole,
		invitedBy: v.id("users"),
		token: v.string(),
		expiresAt: v.number(),
		acceptedAt: v.optional(v.number()),
		status: v.union(
			v.literal("pending"),
			v.literal("accepted"),
			v.literal("expired"),
			v.literal("revoked"),
		),
		createdAt: v.number(),
	})
		.index("by_org", ["organizationId"])
		.index("by_email", ["email"])
		.index("by_token", ["token"])
		.index("by_org_and_email", ["organizationId", "email"]),

	// --- API Credentials (per org, per provider) ---

	apiCredentials: defineTable({
		organizationId: v.id("organizations"),
		provider: providerType,
		environment: tripletexEnv,
		baseUrl: v.string(),
		/** Encrypted JSON string containing provider-specific keys/tokens. */
		credentials: v.string(),
		isEnabled: v.boolean(),
		lastVerifiedAt: v.optional(v.number()),
	})
		.index("by_org", ["organizationId"])
		.index("by_org_and_provider", ["organizationId", "provider"])
		.index("by_org_provider_env", ["organizationId", "provider", "environment"]),

	// --- Integration Schedules ---

	integrationSchedules: defineTable({
		organizationId: v.id("organizations"),
		syncType: syncType,
		tripletexEnv: tripletexEnv,
		// Cron expression in standard format (e.g. "0 0 * * *" for daily)
		cronExpression: v.string(),
		isEnabled: v.boolean(),
		lastScheduledAt: v.optional(v.number()),
		lastCompletedAt: v.optional(v.number()),
	})
		.index("by_org", ["organizationId"])
		.index("by_org_and_type", ["organizationId", "syncType"])
		.index("by_enabled", ["isEnabled"]),

	// --- Department Mapping ---

	departmentMapping: defineTable({
		organizationId: v.id("organizations"),
		rubicDepartmentId: v.number(),
		rubicDepartmentName: v.string(),
		tripletexDepartmentId: v.number(),
		tripletexDepartmentName: v.string(),
		tripletexEnv: tripletexEnv,
	})
		.index("by_org", ["organizationId"])
		.index("by_org_and_env", ["organizationId", "tripletexEnv"])
		.index("by_org_rubic_env", ["organizationId", "rubicDepartmentId", "tripletexEnv"]),

	// --- Sync State (run history) ---

	syncState: defineTable({
		organizationId: v.id("organizations"),
		syncType: syncType,
		tripletexEnv: tripletexEnv,
		lastSyncAt: v.optional(v.number()),
		status: syncStatus,
		errorMessage: v.optional(v.string()),
		recordsProcessed: v.number(),
		recordsFailed: v.number(),
		startedAt: v.number(),
		completedAt: v.optional(v.number()),
	})
		.index("by_org", ["organizationId"])
		.index("by_org_and_type", ["organizationId", "syncType"])
		.index("by_org_type_env", ["organizationId", "syncType", "tripletexEnv"])
		.index("by_status", ["status"]),

	// --- Customer Mapping ---

	customerMapping: defineTable({
		organizationId: v.id("organizations"),
		rubicCustomerNo: v.string(),
		tripletexEnv: tripletexEnv,
		tripletexCustomerId: v.number(),
		lastSyncedAt: v.number(),
		hash: v.optional(v.string()),
	})
		.index("by_org", ["organizationId"])
		.index("by_org_and_env", ["organizationId", "tripletexEnv"])
		.index("by_org_rubic_env", ["organizationId", "rubicCustomerNo", "tripletexEnv"]),

	// --- Product Mapping ---

	productMapping: defineTable({
		organizationId: v.id("organizations"),
		rubicProductCode: v.string(),
		tripletexEnv: tripletexEnv,
		tripletexProductId: v.number(),
		lastSyncedAt: v.number(),
		hash: v.optional(v.string()),
	})
		.index("by_org", ["organizationId"])
		.index("by_org_and_env", ["organizationId", "tripletexEnv"])
		.index("by_org_rubic_env", ["organizationId", "rubicProductCode", "tripletexEnv"]),

	// --- Invoice Mapping ---

	invoiceMapping: defineTable({
		organizationId: v.id("organizations"),
		rubicInvoiceId: v.number(),
		tripletexEnv: tripletexEnv,
		rubicInvoiceNumber: v.number(),
		tripletexInvoiceId: v.number(),
		lastSyncedAt: v.number(),
		paymentSynced: v.boolean(),
	})
		.index("by_org", ["organizationId"])
		.index("by_org_and_env", ["organizationId", "tripletexEnv"])
		.index("by_org_rubic_env", ["organizationId", "rubicInvoiceId", "tripletexEnv"]),
});
