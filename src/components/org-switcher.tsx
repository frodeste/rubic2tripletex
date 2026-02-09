"use client";

import { useAction, useQuery } from "convex/react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useOrganization } from "@/hooks/use-organization";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function OrgSwitcher() {
	const { organizationId, organizationName, setOrganizationId, userId } = useOrganization();

	// Gate query on userId (set after storeUser completes) rather than raw
	// useConvexAuth().isAuthenticated to avoid querying before the user record exists.
	const orgs = useQuery(api.organizations.listForUser, userId ? {} : "skip");
	const createOrg = useAction(api.organizations.create);

	const [popoverOpen, setPopoverOpen] = useState(false);
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
			const message = e instanceof Error ? e.message : "Failed to create organization.";
			setError(message);
			toast.error("Failed to create organization", { description: message });
		} finally {
			setIsCreating(false);
		}
	}

	function handleSelectOrg(orgId: string) {
		setOrganizationId(orgId as Id<"organizations">);
		setPopoverOpen(false);
	}

	function handleCreateClick() {
		setPopoverOpen(false);
		setDialogOpen(true);
	}

	const validOrgs = orgs?.filter((org): org is NonNullable<typeof org> => org !== null) ?? [];

	return (
		<>
			<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger asChild>
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
								{validOrgs.length} organization{validOrgs.length !== 1 ? "s" : ""}
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4" />
					</SidebarMenuButton>
				</PopoverTrigger>
				<PopoverContent className="min-w-56 p-0" align="start">
					<Command>
						<CommandInput placeholder="Search organizations..." />
						<CommandList>
							<CommandEmpty>No organizations found.</CommandEmpty>
							<CommandGroup>
								{validOrgs.map((org) => (
									<CommandItem
										key={org._id}
										value={org.name}
										onSelect={() => handleSelectOrg(org._id)}
										className="gap-2"
									>
										<Building2 className="size-4 shrink-0" />
										<span className="truncate">{org.name}</span>
										{org._id === organizationId && <Check className="ml-auto size-4 shrink-0" />}
									</CommandItem>
								))}
							</CommandGroup>
							<CommandSeparator />
							<CommandGroup>
								<CommandItem onSelect={handleCreateClick} className="gap-2">
									<Plus className="size-4 shrink-0" />
									<span>Create Organization</span>
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

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
