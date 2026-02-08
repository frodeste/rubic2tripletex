"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useQuery } from "convex/react";
import { Building2, ChevronsUpDown } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useOrganization } from "@/hooks/use-organization";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenuButton,
} from "@/components/ui/sidebar";

export function OrgSwitcher() {
	const { user } = useUser();
	const { organizationId, organizationName, setOrganizationId } = useOrganization();

	const auth0UserId = user?.sub ?? "";
	const orgs = useQuery(
		api.organizations.listForUser,
		auth0UserId ? { auth0UserId } : "skip",
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					size="lg"
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
				>
					<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
						<Building2 className="size-4" />
					</div>
					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-semibold">
							{organizationName ?? "Select Organization"}
						</span>
						<span className="truncate text-xs text-muted-foreground">
							{orgs?.length ?? 0} organization{(orgs?.length ?? 0) !== 1 ? "s" : ""}
						</span>
					</div>
					<ChevronsUpDown className="ml-auto size-4" />
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
				align="start"
				side="bottom"
				sideOffset={4}
			>
				{orgs?.map((org) =>
					org ? (
						<DropdownMenuItem
							key={org._id}
							onClick={() => setOrganizationId(org._id)}
							className="gap-2 p-2"
						>
							<div className="flex size-6 items-center justify-center rounded-sm border">
								<Building2 className="size-4 shrink-0" />
							</div>
							<span className="truncate">{org.name}</span>
							{org._id === organizationId && (
								<span className="ml-auto text-xs text-muted-foreground">Active</span>
							)}
						</DropdownMenuItem>
					) : null,
				)}
				{(!orgs || orgs.length === 0) && (
					<DropdownMenuItem disabled>No organizations available</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
