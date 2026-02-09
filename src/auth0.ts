import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
	appBaseUrl: process.env.AUTH0_BASE_URL ?? "http://localhost:3000",
	// Explicitly request offline_access for refresh tokens.
	// This is the v4 default, but being explicit ensures token refresh
	// continues working if defaults change in future SDK versions.
	authorizationParameters: {
		scope: "openid profile email offline_access",
	},
});
