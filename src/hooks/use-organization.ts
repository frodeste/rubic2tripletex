"use client";

import { createContext, useContext } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export interface OrganizationContextValue {
	userId: Id<"users"> | null;
	organizationId: Id<"organizations"> | null;
	organizationName: string | null;
	auth0OrgId: string | null;
	role: "owner" | "admin" | "member" | null;
	setOrganizationId: (id: Id<"organizations">) => void;
	isLoading: boolean;
}

export const OrganizationContext = createContext<OrganizationContextValue>({
	userId: null,
	organizationId: null,
	organizationName: null,
	auth0OrgId: null,
	role: null,
	setOrganizationId: () => {},
	isLoading: true,
});

export function useOrganization() {
	const context = useContext(OrganizationContext);
	if (!context) {
		throw new Error("useOrganization must be used within an OrganizationProvider");
	}
	return context;
}
