import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * HTTP endpoint for Auth0 Post-Login Action to upsert a user record
 * and (optionally) sync organization membership from an accepted invitation.
 *
 * Auth0 calls this endpoint after every successful login. When the user
 * accepted an Auth0 Organization Invitation, `event.organization` is present
 * in the Auth0 Action context — the Action should forward it here so Convex
 * can create the membership and mark the invitation accepted.
 *
 * Expected JSON body:
 *   {
 *     tokenIdentifier: string,
 *     email: string,
 *     name?: string,
 *     avatarUrl?: string,
 *     organization?: { id: string, name?: string }
 *   }
 *
 * Protected by a shared secret in the Authorization header.
 */
http.route({
	path: "/auth0/upsert-user",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		// Verify shared secret
		const authHeader = request.headers.get("Authorization");
		const expectedSecret = process.env.AUTH0_ACTION_SECRET;

		if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
			return new Response("Unauthorized", { status: 401 });
		}

		const body = (await request.json()) as {
			tokenIdentifier?: string;
			email?: string;
			name?: string;
			avatarUrl?: string;
			organization?: { id: string; name?: string };
		};

		const { tokenIdentifier, email, name, avatarUrl, organization } = body;

		if (!tokenIdentifier || !email) {
			return new Response("Missing required fields: tokenIdentifier, email", {
				status: 400,
			});
		}

		// 1. Upsert the user record
		const userId = await ctx.runMutation(internal.users.upsertFromAuth0, {
			tokenIdentifier,
			email,
			name: name ?? undefined,
			avatarUrl: avatarUrl ?? undefined,
		});

		// 2. If the user logged in with an organization context (e.g. after accepting
		//    an Auth0 Organization Invitation), sync the membership to Convex.
		if (organization?.id) {
			await ctx.runMutation(internal.invitations.syncOrgMembershipFromAuth0, {
				tokenIdentifier,
				email,
				auth0OrgId: organization.id,
			});
		}

		return new Response(JSON.stringify({ userId }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
});

export default http;
