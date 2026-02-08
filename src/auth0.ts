import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
	appBaseUrl: process.env.AUTH0_BASE_URL ?? "http://localhost:3000",
	// Auth0 Organizations support:
	// When a user logs in, Auth0 will include org_id in the token
	// if they belong to an organization. This is configured in the
	// Auth0 dashboard under Organizations settings.
});
