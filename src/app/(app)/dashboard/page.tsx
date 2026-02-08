"use client";

import { useAction, useQuery } from "convex/react";
import {
	Activity,
	ArrowLeftRight,
	CheckCircle2,
	Clock,
	Loader2,
	Play,
	Users,
	XCircle,
	Package,
	FileText,
	CreditCard,
} from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { useOrganization } from "@/hooks/use-organization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const syncTypeConfig = {
	customers: { label: "Customers", icon: Users, color: "bg-blue-500" },
	products: { label: "Products", icon: Package, color: "bg-emerald-500" },
	invoices: { label: "Invoices", icon: FileText, color: "bg-amber-500" },
	payments: { label: "Payments", icon: CreditCard, color: "bg-purple-500" },
} as const;

type SyncType = keyof typeof syncTypeConfig;

function StatusBadge({ status }: { status: string }) {
	switch (status) {
		case "success":
			return (
				<Badge
					variant="default"
					className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
				>
					<CheckCircle2 className="mr-1 h-3 w-3" />
					Success
				</Badge>
			);
		case "failed":
			return (
				<Badge
					variant="default"
					className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
				>
					<XCircle className="mr-1 h-3 w-3" />
					Failed
				</Badge>
			);
		case "running":
			return (
				<Badge
					variant="default"
					className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
				>
					<Loader2 className="mr-1 h-3 w-3 animate-spin" />
					Running
				</Badge>
			);
		default:
			return <Badge variant="secondary">{status}</Badge>;
	}
}

function EnvBadge({ env }: { env: string }) {
	return env === "production" ? (
		<Badge
			variant="default"
			className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
		>
			Production
		</Badge>
	) : (
		<Badge
			variant="default"
			className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
		>
			Sandbox
		</Badge>
	);
}

function formatDate(timestamp: number | undefined | null): string {
	if (!timestamp) return "-";
	return new Date(timestamp).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function QuickSyncButton({
	syncType,
	tripletexEnv,
}: {
	syncType: SyncType;
	tripletexEnv: "sandbox" | "production";
}) {
	const { organizationId } = useOrganization();
	const [isRunning, setIsRunning] = useState(false);
	const runSync = useAction(
		syncType === "customers"
			? api.sync.runCustomersPublic
			: syncType === "products"
				? api.sync.runProductsPublic
				: syncType === "invoices"
					? api.sync.runInvoicesPublic
					: api.sync.runPaymentsPublic,
	);

	const config = syncTypeConfig[syncType];

	const handleRun = async () => {
		if (!organizationId) return;
		setIsRunning(true);
		try {
			await runSync({ organizationId, tripletexEnv });
		} catch (error) {
			console.error(`Sync ${syncType} failed:`, error);
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleRun}
			disabled={isRunning || !organizationId}
			className="gap-2"
		>
			{isRunning ? (
				<Loader2 className="h-3.5 w-3.5 animate-spin" />
			) : (
				<Play className="h-3.5 w-3.5" />
			)}
			{config.label}
		</Button>
	);
}

export default function DashboardPage() {
	const { organizationId, organizationName, isLoading: orgLoading } = useOrganization();

	const syncRuns = useQuery(
		api.syncState.list,
		organizationId ? { organizationId, limit: 30 } : "skip",
	);

	const runningJobs = useQuery(
		api.syncState.getRunning,
		organizationId ? { organizationId } : "skip",
	);

	const credentials = useQuery(
		api.apiCredentials.list,
		organizationId ? { organizationId } : "skip",
	);

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
				<ArrowLeftRight className="h-12 w-12 text-muted-foreground" />
				<h2 className="text-xl font-semibold">No Organization Selected</h2>
				<p className="text-muted-foreground">Select or create an organization to get started.</p>
			</div>
		);
	}

	const enabledEnvs: Array<"sandbox" | "production"> = [];
	if (credentials) {
		const tripletexCreds = credentials.filter(
			(c) => c.provider === "tripletex" && c.isEnabled,
		);
		for (const c of tripletexCreds) {
			const env = c.environment as "sandbox" | "production";
			if (!enabledEnvs.includes(env)) {
				enabledEnvs.push(env);
			}
		}
	}

	const runs: Doc<"syncState">[] = syncRuns ?? [];
	const totalProcessed = runs.reduce((sum, r) => sum + r.recordsProcessed, 0);
	const totalFailed = runs.reduce((sum, r) => sum + r.recordsFailed, 0);
	const successCount = runs.filter((r) => r.status === "success").length;
	const failedCount = runs.filter((r) => r.status === "failed").length;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">{organizationName}</h1>
				<p className="text-muted-foreground">Integration dashboard overview</p>
			</div>

			{/* Stats cards */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Running</CardTitle>
						<Activity className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{runningJobs?.length ?? 0}</div>
						<p className="text-xs text-muted-foreground">Active sync jobs</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Successful</CardTitle>
						<CheckCircle2 className="h-4 w-4 text-emerald-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{successCount}</div>
						<p className="text-xs text-muted-foreground">
							{totalProcessed.toLocaleString()} records processed
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Failed</CardTitle>
						<XCircle className="h-4 w-4 text-red-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{failedCount}</div>
						<p className="text-xs text-muted-foreground">
							{totalFailed.toLocaleString()} records failed
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Last Sync</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{syncRuns && syncRuns.length > 0 ? formatDate(syncRuns[0].startedAt) : "-"}
						</div>
						<p className="text-xs text-muted-foreground">Most recent run</p>
					</CardContent>
				</Card>
			</div>

			{/* Quick actions */}
			{enabledEnvs.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Quick Sync</CardTitle>
						<CardDescription>Manually trigger sync operations</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{enabledEnvs.map((env) => (
								<div key={env} className="space-y-2">
									<div className="flex items-center gap-2">
										<EnvBadge env={env} />
									</div>
									<div className="flex flex-wrap gap-2">
										{(Object.keys(syncTypeConfig) as SyncType[]).map((type) => (
											<QuickSyncButton key={`${env}-${type}`} syncType={type} tripletexEnv={env} />
										))}
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{enabledEnvs.length === 0 && (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<ArrowLeftRight className="mb-4 h-10 w-10 text-muted-foreground" />
						<h3 className="text-lg font-semibold">No Integrations Configured</h3>
						<p className="mt-1 text-sm text-muted-foreground">
							Go to Settings to configure your Rubic and Tripletex API credentials.
						</p>
					</CardContent>
				</Card>
			)}

			{/* Recent sync runs */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Recent Sync Runs</CardTitle>
					<CardDescription>Latest synchronization activity</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Environment</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Started</TableHead>
								<TableHead>Completed</TableHead>
								<TableHead className="text-right">Processed</TableHead>
								<TableHead className="text-right">Failed</TableHead>
								<TableHead>Error</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{syncRuns && syncRuns.length > 0 ? (
								syncRuns.map((run) => (
									<TableRow key={run._id}>
										<TableCell>
											<EnvBadge env={run.tripletexEnv} />
										</TableCell>
										<TableCell className="font-medium capitalize">{run.syncType}</TableCell>
										<TableCell>
											<StatusBadge status={run.status} />
										</TableCell>
										<TableCell className="text-muted-foreground">
											{formatDate(run.startedAt)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{formatDate(run.completedAt)}
										</TableCell>
										<TableCell className="text-right">{run.recordsProcessed}</TableCell>
										<TableCell className="text-right">{run.recordsFailed}</TableCell>
										<TableCell
											className="max-w-[200px] truncate text-red-500"
											title={run.errorMessage ?? undefined}
										>
											{run.errorMessage ?? "-"}
										</TableCell>
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
										No sync runs yet
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
