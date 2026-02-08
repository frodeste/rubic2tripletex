"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useMutation, useQuery } from "convex/react";
import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPositioner,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useOrganization } from "@/hooks/use-organization";
import { api } from "../../convex/_generated/api";

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function OrgSwitcher() {
	const { user } = useUser();
	const { organizationId, organizationName, setOrganizationId } = useOrganization();

	const isAuthenticated = !!user?.sub;
	const orgs = useQuery(api.organizations.listForUser, isAuthenticated ? {} : "skip");
	const createOrg = useMutation(api.organizations.create);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [newOrgName, setNewOrgName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleCreateOrg() {
		const trimmedName = newOrgName.trim();
		if (!trimmedName) return;

		const slug = slugify(trimmedName);
		if (!slug) {
			setError("Please enter a valid organization name.");
			return;
		}

		setIsCreating(true);
		setError(null);
		try {
			const orgId = await createOrg({
				name: trimmedName,
				slug,
			});
			setOrganizationId(orgId);
			setDialogOpen(false);
			setNewOrgName("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create organization.");
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						/>
					}
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
				</DropdownMenuTrigger>
				<DropdownMenuPositioner align="start" side="bottom">
					<DropdownMenuContent className="min-w-56 rounded-lg">
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
							<DropdownMenuItem disabled className="text-muted-foreground">
								No organizations yet
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => setDialogOpen(true)} className="gap-2 p-2">
							<div className="flex size-6 items-center justify-center rounded-sm border bg-background">
								<Plus className="size-4 shrink-0" />
							</div>
							<span className="font-medium">Create Organization</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenuPositioner>
			</DropdownMenu>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Organization</DialogTitle>
						<DialogDescription>
							Enter a name for your new organization. You can change it later in settings.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleCreateOrg();
						}}
					>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<Label htmlFor="org-name">Organization name</Label>
								<Input
									id="org-name"
									placeholder="My Company"
									value={newOrgName}
									onChange={(e) => {
										setNewOrgName(e.target.value);
										setError(null);
									}}
									autoFocus
								/>
								{newOrgName.trim() && (
									<p className="text-xs text-muted-foreground">
										Slug: {slugify(newOrgName.trim()) || "—"}
									</p>
								)}
								{error && <p className="text-sm text-destructive">{error}</p>}
							</div>
						</div>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={!newOrgName.trim() || isCreating}>
								{isCreating ? "Creating..." : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
