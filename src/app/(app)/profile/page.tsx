"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useAction, useQuery } from "convex/react";
import { Loader2, Mail, Pencil, Save, Settings, Shield, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/hooks/use-organization";
import { getInitials } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";

export default function ProfilePage() {
	const { user: auth0User, isLoading: auth0Loading } = useUser();
	const { userId, isLoading: orgLoading } = useOrganization();
	const convexUser = useQuery(api.users.me, userId ? {} : "skip");
	const updateProfile = useAction(api.users.updateProfile);

	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");

	const isLoading = auth0Loading || orgLoading || (userId && convexUser === undefined);

	// Sync form state from Convex user data
	useEffect(() => {
		if (convexUser) {
			setName(convexUser.name ?? "");
			setPhone(convexUser.phone ?? "");
			setAvatarUrl(convexUser.avatarUrl ?? "");
		}
	}, [convexUser]);

	const handleSave = async () => {
		setSaving(true);
		try {
			await updateProfile({
				name: name.trim(),
				phone: phone.trim(),
				avatarUrl: avatarUrl.trim(),
			});
			toast.success("Profile updated");
			setEditing(false);
		} catch (error) {
			console.error("Failed to update profile:", error);
			toast.error("Failed to update profile", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setSaving(false);
		}
	};

	const handleCancel = () => {
		// Reset form to current values
		setName(convexUser?.name ?? "");
		setPhone(convexUser?.phone ?? "");
		setAvatarUrl(convexUser?.avatarUrl ?? "");
		setEditing(false);
	};

	if (isLoading) {
		return (
			<div className="flex h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const displayName = name || auth0User?.name || "User";
	const initials = getInitials(displayName, convexUser?.email ?? auth0User?.email);

	const formatDate = (timestamp: number | undefined) => {
		if (!timestamp) return "Never";
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const formatDateTime = (timestamp: number | undefined) => {
		if (!timestamp) return "Never";
		return new Date(timestamp).toLocaleString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Profile</h1>
				<p className="text-muted-foreground">Manage your account settings and preferences</p>
			</div>

			<Tabs defaultValue="general">
				<TabsList>
					<TabsTrigger value="general" className="gap-2">
						<User className="h-4 w-4" />
						General
					</TabsTrigger>
					<TabsTrigger value="preferences" className="gap-2">
						<Settings className="h-4 w-4" />
						Preferences
					</TabsTrigger>
					<TabsTrigger value="security" className="gap-2">
						<Shield className="h-4 w-4" />
						Security
					</TabsTrigger>
				</TabsList>

				<TabsContent value="general" className="mt-4 space-y-4">
					{/* Profile Card */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Profile Information</CardTitle>
									<CardDescription>
										Your display name, phone, and avatar used across the application
									</CardDescription>
								</div>
								{!editing ? (
									<Button
										variant="outline"
										size="sm"
										className="gap-2"
										onClick={() => setEditing(true)}
									>
										<Pencil className="h-4 w-4" />
										Edit
									</Button>
								) : (
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											className="gap-2"
											onClick={handleCancel}
											disabled={saving}
										>
											<X className="h-4 w-4" />
											Cancel
										</Button>
										<Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
											{saving ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Save className="h-4 w-4" />
											)}
											Save
										</Button>
									</div>
								)}
							</div>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center gap-6">
								<Avatar className="h-24 w-24">
									<AvatarImage
										src={avatarUrl || auth0User?.picture || undefined}
										alt={displayName}
									/>
									<AvatarFallback className="text-2xl">{initials}</AvatarFallback>
								</Avatar>
								{editing && (
									<div className="flex-1 space-y-2">
										<Label>Avatar URL</Label>
										<Input
											value={avatarUrl}
											onChange={(e) => setAvatarUrl(e.target.value)}
											placeholder="https://example.com/avatar.jpg"
										/>
										<p className="text-xs text-muted-foreground">
											Leave empty to use your Auth0 profile picture
										</p>
									</div>
								)}
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Name</Label>
									{editing ? (
										<Input
											value={name}
											onChange={(e) => setName(e.target.value)}
											placeholder="Your full name"
										/>
									) : (
										<p className="text-sm">{convexUser?.name || "Not set"}</p>
									)}
								</div>

								<div className="space-y-2">
									<Label>
										<span className="flex items-center gap-1.5">
											<Mail className="h-3.5 w-3.5" />
											Email
										</span>
									</Label>
									<p className="text-sm">{convexUser?.email ?? auth0User?.email ?? "No email"}</p>
									<p className="text-xs text-muted-foreground">
										Managed by Auth0 — change via your identity provider
									</p>
								</div>

								<div className="space-y-2">
									<Label>Phone</Label>
									{editing ? (
										<Input
											value={phone}
											onChange={(e) => setPhone(e.target.value)}
											placeholder="+47 123 45 678"
											type="tel"
										/>
									) : (
										<p className="text-sm">{convexUser?.phone || "Not set"}</p>
									)}
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Account Info Card (read-only) */}
					<Card>
						<CardHeader>
							<CardTitle>Account</CardTitle>
							<CardDescription>Read-only account information from Auth0 and Convex</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label className="text-muted-foreground">Account ID</Label>
									<p className="text-sm font-mono">{auth0User?.sub ?? "N/A"}</p>
								</div>
								<div className="space-y-2">
									<Label className="text-muted-foreground">Auth Provider</Label>
									<p className="text-sm">Auth0</p>
								</div>
								<div className="space-y-2">
									<Label className="text-muted-foreground">Member since</Label>
									<p className="text-sm">{formatDate(convexUser?.createdAt)}</p>
								</div>
								<div className="space-y-2">
									<Label className="text-muted-foreground">Last active</Label>
									<p className="text-sm">{formatDateTime(convexUser?.lastActiveAt)}</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="preferences" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Preferences</CardTitle>
							<CardDescription>Manage your application preferences</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label>Default Organization</Label>
								<p className="text-sm text-muted-foreground">
									{convexUser?.preferences?.defaultOrgId ?? "None set"}
								</p>
							</div>
							<p className="text-sm text-muted-foreground">
								More preferences will be available in a future update.
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="security" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Security</CardTitle>
							<CardDescription>Manage your security settings</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								MFA and security settings are managed by Auth0. Visit your identity provider to
								update password, enable MFA, or manage connected accounts.
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
