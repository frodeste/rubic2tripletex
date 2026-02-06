import { z } from "zod";
import type { TripletexEnv } from "@/db/schema";

const envSchema = z.object({
	// Database
	DATABASE_URL: z.string().url(),
	DATABASE_URL_UNPOOLED: z.string().url(),

	// Rubic API
	RUBIC_API_BASE_URL: z.string().url().default("https://rubicexternalapitest.azurewebsites.net"),
	RUBIC_API_KEY: z.string().min(1),
	RUBIC_ORGANIZATION_ID: z.coerce.number().int().positive(),

	// Tripletex Production
	TRIPLETEX_PROD_ENABLED: z
		.enum(["true", "false"])
		.default("false")
		.transform((v) => v === "true"),
	TRIPLETEX_PROD_BASE_URL: z.string().url().default("https://tripletex.no/v2"),
	TRIPLETEX_PROD_CONSUMER_TOKEN: z.string().min(1).optional(),
	TRIPLETEX_PROD_EMPLOYEE_TOKEN: z.string().min(1).optional(),

	// Tripletex Sandbox
	TRIPLETEX_SANDBOX_ENABLED: z
		.enum(["true", "false"])
		.default("false")
		.transform((v) => v === "true"),
	TRIPLETEX_SANDBOX_BASE_URL: z.string().url().default("https://api.tripletex.io/v2"),
	TRIPLETEX_SANDBOX_CONSUMER_TOKEN: z.string().min(1).optional(),
	TRIPLETEX_SANDBOX_EMPLOYEE_TOKEN: z.string().min(1).optional(),

	// Legacy Tripletex env vars (fallback for production if TRIPLETEX_PROD_* not set)
	TRIPLETEX_API_BASE_URL: z.string().url().optional(),
	TRIPLETEX_CONSUMER_TOKEN: z.string().min(1).optional(),
	TRIPLETEX_EMPLOYEE_TOKEN: z.string().min(1).optional(),

	// Auth0 (v4 SDK env var names)
	AUTH0_SECRET: z.string().min(1),
	AUTH0_DOMAIN: z.string().min(1),
	AUTH0_CLIENT_ID: z.string().min(1),
	AUTH0_CLIENT_SECRET: z.string().min(1),
	APP_BASE_URL: z.string().url().default("https://integration.uniteperformance.no"),

	// Vercel Cron
	CRON_SECRET: z.string().min(1).optional(),

	// Environment
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _config: Env | null = null;

export function getConfig(): Env {
	if (!_config) {
		_config = envSchema.parse(process.env);
	}
	return _config;
}

/**
 * Get a partial config for cases where not all env vars are available
 * (e.g., during build time or in cron endpoints that only need specific vars).
 */
export function getPartialConfig() {
	return {
		databaseUrl: process.env.DATABASE_URL,
		cronSecret: process.env.CRON_SECRET,
		nodeEnv: process.env.NODE_ENV ?? "development",
	};
}

/** Configuration for a single Tripletex environment. */
export interface TripletexEnvConfig {
	env: TripletexEnv;
	baseUrl: string;
	consumerToken: string;
	employeeToken: string;
}

/**
 * Returns the list of enabled Tripletex environments with their credentials.
 * Falls back to legacy TRIPLETEX_* env vars for production if the new
 * TRIPLETEX_PROD_* vars are not set.
 */
export function getEnabledTripletexEnvs(): TripletexEnvConfig[] {
	const config = getConfig();
	const envs: TripletexEnvConfig[] = [];

	if (config.TRIPLETEX_PROD_ENABLED) {
		const consumerToken =
			config.TRIPLETEX_PROD_CONSUMER_TOKEN ?? config.TRIPLETEX_CONSUMER_TOKEN;
		const employeeToken =
			config.TRIPLETEX_PROD_EMPLOYEE_TOKEN ?? config.TRIPLETEX_EMPLOYEE_TOKEN;
		const baseUrl = config.TRIPLETEX_PROD_BASE_URL ?? config.TRIPLETEX_API_BASE_URL;

		if (consumerToken && employeeToken && baseUrl) {
			envs.push({
				env: "production",
				baseUrl,
				consumerToken,
				employeeToken,
			});
		}
	}

	if (config.TRIPLETEX_SANDBOX_ENABLED) {
		const consumerToken = config.TRIPLETEX_SANDBOX_CONSUMER_TOKEN;
		const employeeToken = config.TRIPLETEX_SANDBOX_EMPLOYEE_TOKEN;

		if (consumerToken && employeeToken) {
			envs.push({
				env: "sandbox",
				baseUrl: config.TRIPLETEX_SANDBOX_BASE_URL,
				consumerToken,
				employeeToken,
			});
		}
	}

	return envs;
}

/**
 * Get the Tripletex environment config for a specific environment.
 * Returns null if the environment is not enabled or credentials are missing.
 */
export function getTripletexEnvConfig(env: TripletexEnv): TripletexEnvConfig | null {
	return getEnabledTripletexEnvs().find((e) => e.env === env) ?? null;
}
