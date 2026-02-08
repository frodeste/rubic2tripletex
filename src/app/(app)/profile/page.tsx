"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useQuery } from "convex/react";
import { Loader2, Mail, Settings, Shield, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/hooks/use-organization";
import { api } from "../../../../convex/_generated/api";

export default function ProfilePage() {
	const { user: auth0User, isLoading: auth0Loading } = useUser();
	const { userId, isLoading: orgLoading } = useOrganization();
	const convexUser = useQuery(api.users.me, userId ? {} : "skip");

	const isLoading = auth0Loading || orgLoading || (userId && convexUser === undefined);

	if (isLoading) {
		return (
			<div className="flex h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const initials = auth0User?.name
		? auth0User.name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
		: "U";

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

				<TabsContent value="general" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>General Information</CardTitle>
							<CardDescription>Your account details from Auth0</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center gap-6">
								<Avatar className="h-24 w-24">
									<AvatarImage
										src={auth0User?.picture ?? undefined}
										alt={auth0User?.name ?? "User"}
									/>
									<AvatarFallback className="text-2xl">{initials}</AvatarFallback>
								</Avatar>
								<div className="space-y-1">
									<h3 className="text-lg font-semibold">{auth0User?.name ?? "User"}</h3>
									<div className="flex items-center gap-2 text-muted-foreground">
										<Mail className="h-4 w-4" />
										<span>{auth0User?.email ?? "No email"}</span>
									</div>
								</div>
							</div>

							<div className="space-y-4 border-t pt-4">
								<div className="space-y-2">
									<Label className="text-muted-foreground">Account ID</Label>
									<p className="text-sm font-mono">{auth0User?.sub ?? "N/A"}</p>
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
								MFA and security settings will be available in a future update.
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
