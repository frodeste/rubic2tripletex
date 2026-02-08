"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { OrganizationContext } from "@/hooks/use-organization";

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
	const { user, isLoading: userLoading } = useUser();
	const [selectedOrgId, setSelectedOrgId] = useState<Id<"organizations"> | null>(null);

	const isAuthenticated = !!user?.sub;
	// listForUser uses auth identity server-side — no args needed

	const orgs = useQuery(api.organizations.listForUser, isAuthenticated ? {} : "skip");

	const isLoading = userLoading || orgs === undefined;

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
		// Persist selection in localStorage
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
			organizationId: selectedOrgId,
			organizationName: selectedOrg?.name ?? null,
			auth0OrgId: selectedOrg?.auth0OrgId ?? null,
			role: (selectedOrg as any)?.role ?? null,
			setOrganizationId,
			isLoading,
		}),
		[selectedOrgId, selectedOrg, setOrganizationId, isLoading],
	);

	return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}
