"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Building2,
	Crown,
	Loader2,
	Mail,
	Settings,
	Shield,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/hooks/use-organization";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

function getInitials(name: string | undefined, email: string): string {
	if (name) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return parts[0][0].toUpperCase();
	}
	return email[0].toUpperCase();
}

function RoleBadge({ role }: { role: "owner" | "admin" | "member" }) {
	if (role === "owner") {
		return (
			<Badge variant="default" className="gap-1">
				<Crown className="h-3 w-3" />
				Owner
			</Badge>
		);
	}
	if (role === "admin") {
		return (
			<Badge variant="default" className="gap-1">
				<Shield className="h-3 w-3" />
				Admin
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="gap-1">
			<Users className="h-3 w-3" />
			Member
		</Badge>
	);
}

function InviteMemberDialog({ organizationId }: { organizationId: Id<"organizations"> }) {
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<"admin" | "member">("member");
	const [saving, setSaving] = useState(false);

	const createInvitation = useMutation(api.invitations.create);

	const handleInvite = async () => {
		if (!email.trim()) return;
		setSaving(true);
		try {
			await createInvitation({
				organizationId,
				email: email.trim(),
				role,
			});
			setEmail("");
			setRole("member");
			setOpen(false);
		} catch (error) {
			console.error("Failed to create invitation:", error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button className="gap-2" />}>
				<UserPlus className="h-4 w-4" />
				Invite Member
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invite Member</DialogTitle>
					<DialogDescription>Send an invitation to join this organization.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label>Email</Label>
						<Input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="user@example.com"
						/>
					</div>
					<div className="space-y-2">
						<Label>Role</Label>
						<Select value={role} onValueChange={(v) => v && setRole(v as "admin" | "member")}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									<SelectItem value="member">Member</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handleInvite} disabled={saving || !email.trim()}>
						{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Send Invitation
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function OrganizationProfilePage() {
	const { organizationId, role, userId, isLoading: orgLoading } = useOrganization();

	const organization = useQuery(
		api.organizations.get,
		organizationId ? { organizationId } : "skip",
	);

	const members = useQuery(
		api.organizations.listMembers,
		organizationId ? { organizationId } : "skip",
	);

	const invitations = useQuery(
		api.invitations.listForOrg,
		organizationId ? { organizationId } : "skip",
	);

	const updateOrganization = useMutation(api.organizations.update);
	const removeMember = useMutation(api.organizations.removeMember);
	const revokeInvitation = useMutation(api.invitations.revoke);

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [saving, setSaving] = useState(false);

	const isAdminOrOwner = role === "admin" || role === "owner";

	// Update local state when organization data loads
	useEffect(() => {
		if (organization) {
			setName(organization.name);
			setSlug(organization.slug);
		}
	}, [organization]);

	const handleSave = async () => {
		if (!organizationId) return;
		setSaving(true);
		try {
			await updateOrganization({
				organizationId,
				name: name !== organization?.name ? name : undefined,
				slug: slug !== organization?.slug ? slug : undefined,
			});
		} catch (error) {
			console.error("Failed to update organization:", error);
		} finally {
			setSaving(false);
		}
	};

	const handleRemoveMember = async (memberUserId: Id<"users">) => {
		if (!organizationId) return;
		try {
			await removeMember({
				organizationId,
				userId: memberUserId,
			});
		} catch (error) {
			console.error("Failed to remove member:", error);
		}
	};

	const handleRevokeInvitation = async (invitationId: Id<"invitations">) => {
		try {
			await revokeInvitation({ invitationId });
		} catch (error) {
			console.error("Failed to revoke invitation:", error);
		}
	};

	if (orgLoading) {
		return (
			<div className="flex h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!organizationId || !organization) {
		return (
			<div className="flex h-[50vh] flex-col items-center justify-center gap-4">
				<Building2 className="h-12 w-12 text-muted-foreground" />
				<h2 className="text-xl font-semibold">No Organization Selected</h2>
			</div>
		);
	}

	const pendingInvitations = invitations?.filter((inv) => inv.status === "pending") ?? [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Organization Profile</h1>
				<p className="text-muted-foreground">Manage your organization settings and members</p>
			</div>

			<Tabs defaultValue="general">
				<TabsList>
					<TabsTrigger value="general" className="gap-2">
						<Settings className="h-4 w-4" />
						General
					</TabsTrigger>
					<TabsTrigger value="members" className="gap-2">
						<Users className="h-4 w-4" />
						Members
					</TabsTrigger>
				</TabsList>

				<TabsContent value="general" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Organization Details</CardTitle>
							<CardDescription>Update your organization name and slug</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label>Name</Label>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									disabled={!isAdminOrOwner}
									placeholder="Organization name"
								/>
							</div>
							<div className="space-y-2">
								<Label>Slug</Label>
								<Input
									value={slug}
									onChange={(e) => setSlug(e.target.value)}
									disabled={!isAdminOrOwner}
									placeholder="organization-slug"
								/>
							</div>
							{isAdminOrOwner && (
								<Button onClick={handleSave} disabled={saving} className="gap-2">
									{saving && <Loader2 className="h-4 w-4 animate-spin" />}
									Save Changes
								</Button>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="members" className="mt-4 space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-lg">Members</CardTitle>
									<CardDescription>Manage organization members</CardDescription>
								</div>
								{isAdminOrOwner && organizationId && (
									<InviteMemberDialog organizationId={organizationId} />
								)}
							</div>
						</CardHeader>
						<CardContent>
							{members && members.length > 0 ? (
								<div className="space-y-3">
									{members.map((member) => {
										if (!member) return null;
										const isSelf = member.userId === userId;
										const canRemove = isAdminOrOwner && !isSelf && member.role !== "owner";
										const displayName = member.user?.name ?? member.user?.email ?? "Unknown user";

										return (
											<div
												key={member._id}
												className="flex items-center justify-between rounded-lg border p-4"
											>
												<div className="flex items-center gap-3">
													<Avatar className="h-10 w-10">
														<AvatarImage
															src={member.user?.avatarUrl ?? undefined}
															alt={displayName}
														/>
														<AvatarFallback>
															{getInitials(member.user?.name, member.user?.email)}
														</AvatarFallback>
													</Avatar>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-medium">{displayName}</span>
															{isSelf && (
																<Badge variant="outline" className="text-xs">
																	You
																</Badge>
															)}
														</div>
														<p className="text-sm text-muted-foreground">
															Joined {new Date(member.joinedAt).toLocaleDateString()}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-3">
													<RoleBadge role={member.role} />
													{canRemove && (
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 text-destructive"
															onClick={() => handleRemoveMember(member.userId)}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													)}
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<div className="py-8 text-center text-muted-foreground">No members found</div>
							)}
						</CardContent>
					</Card>

					{pendingInvitations.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Pending Invitations</CardTitle>
								<CardDescription>Invitations waiting for acceptance</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{pendingInvitations.map((invitation) => (
										<div
											key={invitation._id}
											className="flex items-center justify-between rounded-lg border p-4"
										>
											<div className="flex items-center gap-3">
												<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
													<Mail className="h-5 w-5 text-muted-foreground" />
												</div>
												<div>
													<div className="flex items-center gap-2">
														<span className="font-medium">{invitation.email}</span>
													</div>
													<p className="text-sm text-muted-foreground">
														Invited {new Date(invitation.createdAt).toLocaleDateString()}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<RoleBadge role={invitation.role} />
												{isAdminOrOwner && (
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive"
														onClick={() => handleRevokeInvitation(invitation._id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
