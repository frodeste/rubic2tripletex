"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OrganizationContext } from "@/hooks/use-organization";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Hook that stores the current Auth0 user in the Convex `users` table
 * following the Convex "useStoreUserEffect" pattern.
 * See: https://docs.convex.dev/auth/database-auth#calling-the-store-user-mutation-from-react
 */
function useStoreUserEffect() {
	const { isLoading, isAuthenticated } = useConvexAuth();
	const [userId, setUserId] = useState<Id<"users"> | null>(null);
	const storeUser = useMutation(api.users.store);

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}
		async function createUser() {
			const id = await storeUser();
			setUserId(id);
		}
		createUser();
		return () => setUserId(null);
	}, [isAuthenticated, storeUser]);

	return useMemo(
		() => ({
			isLoading: isLoading || (isAuthenticated && userId === null),
			isAuthenticated: isAuthenticated && userId !== null,
			userId,
		}),
		[isLoading, isAuthenticated, userId],
	);
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
	const { isLoading: userLoading, isAuthenticated, userId } = useStoreUserEffect();
	const [selectedOrgId, setSelectedOrgId] = useState<Id<"organizations"> | null>(null);

	// Only query orgs once the user is stored in Convex
	const orgs = useQuery(api.organizations.listForUser, isAuthenticated ? {} : "skip");

	const isLoading = userLoading || (isAuthenticated && orgs === undefined);

	// Auto-select first org if none selected
	useEffect(() => {
		if (!selectedOrgId && orgs && orgs.length > 0) {
			const firstOrg = orgs[0];
			if (firstOrg?._id) {
				setSelectedOrgId(firstOrg._id);
			}
		}
	}, [orgs, selectedOrgId]);

	const selectedOrg = orgs?.find((o) => o?._id === selectedOrgId);

	const setOrganizationId = useCallback((id: Id<"organizations">) => {
		setSelectedOrgId(id);
		if (typeof window !== "undefined") {
			localStorage.setItem("selectedOrgId", id);
		}
	}, []);

	// Restore from localStorage on mount
	useEffect(() => {
		if (typeof window !== "undefined" && !selectedOrgId) {
			const stored = localStorage.getItem("selectedOrgId");
			if (stored) {
				setSelectedOrgId(stored as Id<"organizations">);
			}
		}
	}, [selectedOrgId]);

	const value = useMemo(
		() => ({
			userId,
			organizationId: selectedOrgId,
			organizationName: selectedOrg?.name ?? null,
			auth0OrgId: selectedOrg?.auth0OrgId ?? null,
			role: (selectedOrg && "role" in selectedOrg ? selectedOrg.role : null) as
				| "owner"
				| "admin"
				| "member"
				| "billing"
				| "viewer"
				| null,
			setOrganizationId,
			isLoading,
		}),
		[userId, selectedOrgId, selectedOrg, setOrganizationId, isLoading],
	);

	return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}
