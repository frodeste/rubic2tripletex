"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	CheckCircle2,
	Key,
	Loader2,
	Plus,
	Settings,
	Shield,
	TestTube2,
	Trash2,
	Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/hooks/use-organization";
import { api } from "../../../../convex/_generated/api";

// --- Rubic Credential Form ---

function RubicCredentialForm() {
	const { organizationId } = useOrganization();
	const [open, setOpen] = useState(false);
	const [baseUrl, setBaseUrl] = useState("https://rubicexternalapitest.azurewebsites.net");
	const [apiKey, setApiKey] = useState("");
	const [organizationIdField, setOrganizationIdField] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		message?: string;
		error?: string;
	} | null>(null);

	const upsertCredentials = useMutation(api.apiCredentials.upsert);
	const testConnection = useAction(api.sync.testConnectionPublic);

	const parsedOrgId = Number.parseInt(organizationIdField, 10);
	const isOrgIdValid = organizationIdField.trim() !== "" && !Number.isNaN(parsedOrgId);

	const handleSave = async () => {
		if (!organizationId || !isOrgIdValid) return;
		setSaving(true);
		try {
			await upsertCredentials({
				organizationId,
				provider: "rubic",
				environment: "production",
				baseUrl,
				credentials: JSON.stringify({
					apiKey,
					organizationId: parsedOrgId,
				}),
				isEnabled: enabled,
			});
			toast.success("Rubic credentials saved");
			setOpen(false);
		} catch (error) {
			console.error("Failed to save Rubic credentials:", error);
			toast.error("Failed to save Rubic credentials", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setSaving(false);
		}
	};

	const handleTest = async () => {
		if (!organizationId) return;
		setTesting(true);
		setTestResult(null);
		try {
			const result = await testConnection({
				organizationId,
				provider: "rubic",
				environment: "production",
			});
			setTestResult(result);
		} catch (error) {
			console.error("Rubic connection test failed:", error);
			setTestResult({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			toast.error("Rubic connection test failed", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setTesting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
				<Plus className="h-4 w-4" />
				Configure Rubic
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rubic API Credentials</DialogTitle>
					<DialogDescription>Configure your Rubic API connection details.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label>Base URL</Label>
						<Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
					</div>
					<div className="space-y-2">
						<Label>API Key</Label>
						<Input
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="Enter your Rubic API key"
						/>
					</div>
					<div className="space-y-2">
						<Label>Organization ID</Label>
						<Input
							value={organizationIdField}
							onChange={(e) => setOrganizationIdField(e.target.value)}
							placeholder="e.g. 12345"
							inputMode="numeric"
						/>
						{organizationIdField.trim() !== "" && !isOrgIdValid && (
							<p className="text-sm text-destructive">Must be a valid integer.</p>
						)}
					</div>
					<div className="flex items-center justify-between">
						<Label>Enabled</Label>
						<Switch checked={enabled} onCheckedChange={setEnabled} />
					</div>
					{testResult && (
						<div
							className={`rounded-lg p-3 text-sm ${
								testResult.success
									? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
									: "bg-red-500/10 text-red-600 dark:text-red-400"
							}`}
						>
							{testResult.success ? testResult.message : `Error: ${testResult.error}`}
						</div>
					)}
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleTest}
						disabled={testing || !apiKey || !isOrgIdValid}
						className="gap-2"
					>
						{testing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<TestTube2 className="h-4 w-4" />
						)}
						Test Connection
					</Button>
					<Button
						onClick={handleSave}
						disabled={saving || !isOrgIdValid || !apiKey}
						className="gap-2"
					>
						{saving && <Loader2 className="h-4 w-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// --- Tripletex Credential Form ---

function TripletexCredentialForm({ defaultEnv }: { defaultEnv: "sandbox" | "production" }) {
	const { organizationId } = useOrganization();
	const [open, setOpen] = useState(false);
	const [env, setEnv] = useState(defaultEnv);
	const [baseUrl, setBaseUrl] = useState(
		defaultEnv === "sandbox" ? "https://api.tripletex.io/v2" : "https://tripletex.no/v2",
	);
	const [consumerToken, setConsumerToken] = useState("");
	const [employeeToken, setEmployeeToken] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		message?: string;
		error?: string;
	} | null>(null);

	const upsertCredentials = useMutation(api.apiCredentials.upsert);
	const testConnection = useAction(api.sync.testConnectionPublic);

	const handleSave = async () => {
		if (!organizationId) return;
		setSaving(true);
		try {
			await upsertCredentials({
				organizationId,
				provider: "tripletex",
				environment: env,
				baseUrl,
				credentials: JSON.stringify({ consumerToken, employeeToken }),
				isEnabled: enabled,
			});
			toast.success(`Tripletex ${env} credentials saved`);
			setOpen(false);
		} catch (error) {
			console.error("Failed to save Tripletex credentials:", error);
			toast.error("Failed to save Tripletex credentials", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setSaving(false);
		}
	};

	const handleTest = async () => {
		if (!organizationId) return;
		setTesting(true);
		setTestResult(null);
		try {
			const result = await testConnection({
				organizationId,
				provider: "tripletex",
				environment: env,
			});
			setTestResult(result);
		} catch (error) {
			console.error("Tripletex connection test failed:", error);
			setTestResult({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			toast.error("Tripletex connection test failed", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setTesting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
				<Plus className="h-4 w-4" />
				Configure Tripletex ({defaultEnv})
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Tripletex API Credentials</DialogTitle>
					<DialogDescription>Configure your Tripletex {env} connection details.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label>Environment</Label>
						<Select value={env} onValueChange={(v) => v && setEnv(v as "sandbox" | "production")}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									<SelectItem value="production">Production</SelectItem>
									<SelectItem value="sandbox">Sandbox</SelectItem>
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Base URL</Label>
						<Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
					</div>
					<div className="space-y-2">
						<Label>Consumer Token</Label>
						<Input
							type="password"
							value={consumerToken}
							onChange={(e) => setConsumerToken(e.target.value)}
							placeholder="Enter consumer token"
						/>
					</div>
					<div className="space-y-2">
						<Label>Employee Token</Label>
						<Input
							type="password"
							value={employeeToken}
							onChange={(e) => setEmployeeToken(e.target.value)}
							placeholder="Enter employee token"
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label>Enabled</Label>
						<Switch checked={enabled} onCheckedChange={setEnabled} />
					</div>
					{testResult && (
						<div
							className={`rounded-lg p-3 text-sm ${
								testResult.success
									? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
									: "bg-red-500/10 text-red-600 dark:text-red-400"
							}`}
						>
							{testResult.success ? testResult.message : `Error: ${testResult.error}`}
						</div>
					)}
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleTest}
						disabled={testing || !consumerToken || !employeeToken}
						className="gap-2"
					>
						{testing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<TestTube2 className="h-4 w-4" />
						)}
						Test Connection
					</Button>
					<Button onClick={handleSave} disabled={saving} className="gap-2">
						{saving && <Loader2 className="h-4 w-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function SettingsPage() {
	const { organizationId, organizationName, isLoading: orgLoading } = useOrganization();

	const credentials = useQuery(
		api.apiCredentials.list,
		organizationId ? { organizationId } : "skip",
	);

	const members = useQuery(
		api.organizations.listMembers,
		organizationId ? { organizationId } : "skip",
	);

	const removeCredential = useMutation(api.apiCredentials.remove);

	if (orgLoading) {
		return (
			<div className="flex h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!organizationId) {
		return (
			<div className="flex h-[50vh] flex-col items-center justify-center gap-4">
				<Settings className="h-12 w-12 text-muted-foreground" />
				<h2 className="text-xl font-semibold">No Organization Selected</h2>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Settings</h1>
				<p className="text-muted-foreground">Manage API credentials and organization settings</p>
			</div>

			<Tabs defaultValue="credentials">
				<TabsList>
					<TabsTrigger value="credentials" className="gap-2">
						<Key className="h-4 w-4" />
						API Credentials
					</TabsTrigger>
					<TabsTrigger value="members" className="gap-2">
						<Users className="h-4 w-4" />
						Members
					</TabsTrigger>
				</TabsList>

				<TabsContent value="credentials" className="mt-4 space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-lg">API Credentials</CardTitle>
									<CardDescription>
										Manage your Rubic and Tripletex API connection settings
									</CardDescription>
								</div>
								<div className="flex gap-2">
									<RubicCredentialForm />
									<TripletexCredentialForm defaultEnv="production" />
									<TripletexCredentialForm defaultEnv="sandbox" />
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{credentials && credentials.length > 0 ? (
								<div className="space-y-3">
									{credentials.map((cred) => (
										<div
											key={cred._id}
											className="flex items-center justify-between rounded-lg border p-4"
										>
											<div className="flex items-center gap-4">
												<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
													<Shield className="h-5 w-5 text-primary" />
												</div>
												<div>
													<div className="flex items-center gap-2">
														<span className="font-medium capitalize">{cred.provider}</span>
														{cred.provider === "tripletex" && (
															<Badge variant="outline" className="capitalize">
																{cred.environment}
															</Badge>
														)}
													</div>
													<p className="text-sm text-muted-foreground">{cred.baseUrl}</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												{cred.isEnabled ? (
													<Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
														<CheckCircle2 className="mr-1 h-3 w-3" />
														Enabled
													</Badge>
												) : (
													<Badge variant="secondary">Disabled</Badge>
												)}
												{cred.lastVerifiedAt && (
													<span className="text-xs text-muted-foreground">
														Verified {new Date(cred.lastVerifiedAt).toLocaleDateString()}
													</span>
												)}
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-destructive"
													onClick={() => removeCredential({ credentialId: cred._id })}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="py-8 text-center text-muted-foreground">
									No API credentials configured yet. Add your Rubic and Tripletex credentials above.
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="members" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Organization Members</CardTitle>
							<CardDescription>Manage who has access to {organizationName}</CardDescription>
						</CardHeader>
						<CardContent>
							{members && members.length > 0 ? (
								<div className="space-y-3">
									{members.map((member) => {
										if (!member) return null;
										return (
											<div
												key={member._id}
												className="flex items-center justify-between rounded-lg border p-4"
											>
												<div>
													<span className="font-mono text-sm">
														{member.user?.name ?? member.user?.email ?? "Unknown user"}
													</span>
													<p className="text-xs text-muted-foreground">
														Joined {new Date(member.joinedAt).toLocaleDateString()}
													</p>
												</div>
												<Badge variant={member.role === "admin" ? "default" : "secondary"}>
													{member.role}
												</Badge>
											</div>
										);
									})}
								</div>
							) : (
								<div className="py-8 text-center text-muted-foreground">No members found</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
