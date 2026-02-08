"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
	throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
}
const convex = new ConvexReactClient(convexUrl);

/**
 * Custom auth hook that fetches the Auth0 ID token from our API route
 * and passes it to Convex for server-side identity verification.
 */
function useAuthFromAuth0() {
	const { user, isLoading } = useUser();

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			try {
				const response = await fetch("/api/convex-token", {
					cache: forceRefreshToken ? "no-cache" : "default",
				});
				if (!response.ok) return null;
				const data = await response.json();
				return data.token ?? null;
			} catch {
				return null;
			}
		},
		[],
	);

	return useMemo(
		() => ({
			isLoading,
			isAuthenticated: !!user,
			fetchAccessToken,
		}),
		[isLoading, user, fetchAccessToken],
	);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
	return (
		<ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuth0}>
			{children}
		</ConvexProviderWithAuth>
	);
}
