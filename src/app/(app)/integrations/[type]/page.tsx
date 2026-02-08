"use client";

import { useAction, useQuery } from "convex/react";
import {
	ArrowLeft,
	CheckCircle2,
	CreditCard,
	FileText,
	Loader2,
	Package,
	Play,
	Users,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/hooks/use-organization";
import { api } from "../../../../../convex/_generated/api";

const typeConfig = {
	customers: { label: "Customers", icon: Users },
	products: { label: "Products", icon: Package },
	invoices: { label: "Invoices", icon: FileText },
	payments: { label: "Payments", icon: CreditCard },
} as const;

type SyncType = keyof typeof typeConfig;

function formatDate(timestamp: number | undefined | null): string {
	if (!timestamp) return "-";
	return new Date(timestamp).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

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

function MappingsTable({ type, env }: { type: SyncType; env: "sandbox" | "production" }) {
	const { organizationId } = useOrganization();

	const customerMappings = useQuery(
		api.customerMapping.list,
		type === "customers" && organizationId ? { organizationId, tripletexEnv: env } : "skip",
	);

	const productMappings = useQuery(
		api.productMapping.list,
		type === "products" && organizationId ? { organizationId, tripletexEnv: env } : "skip",
	);

	const invoiceMappings = useQuery(
		api.invoiceMapping.list,
		type === "invoices" && organizationId ? { organizationId, tripletexEnv: env } : "skip",
	);

	if (type === "customers") {
		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Rubic Customer No</TableHead>
						<TableHead>Tripletex Customer ID</TableHead>
						<TableHead>Last Synced</TableHead>
						<TableHead>Hash</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{customerMappings && customerMappings.length > 0 ? (
						customerMappings.map((m) => (
							<TableRow key={m._id}>
								<TableCell className="font-mono">{m.rubicCustomerNo}</TableCell>
								<TableCell>{m.tripletexCustomerId}</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(m.lastSyncedAt)}
								</TableCell>
								<TableCell className="font-mono text-xs text-muted-foreground">
									{m.hash?.slice(0, 12)}...
								</TableCell>
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
								No customer mappings yet
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		);
	}

	if (type === "products") {
		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Rubic Product Code</TableHead>
						<TableHead>Tripletex Product ID</TableHead>
						<TableHead>Last Synced</TableHead>
						<TableHead>Hash</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{productMappings && productMappings.length > 0 ? (
						productMappings.map((m) => (
							<TableRow key={m._id}>
								<TableCell className="font-mono">{m.rubicProductCode}</TableCell>
								<TableCell>{m.tripletexProductId}</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(m.lastSyncedAt)}
								</TableCell>
								<TableCell className="font-mono text-xs text-muted-foreground">
									{m.hash?.slice(0, 12)}...
								</TableCell>
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
								No product mappings yet
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		);
	}

	if (type === "invoices") {
		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Rubic Invoice ID</TableHead>
						<TableHead>Rubic Invoice #</TableHead>
						<TableHead>Tripletex Invoice ID</TableHead>
						<TableHead>Payment Synced</TableHead>
						<TableHead>Last Synced</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{invoiceMappings && invoiceMappings.length > 0 ? (
						invoiceMappings.map((m) => (
							<TableRow key={m._id}>
								<TableCell>{m.rubicInvoiceId}</TableCell>
								<TableCell>{m.rubicInvoiceNumber}</TableCell>
								<TableCell>{m.tripletexInvoiceId}</TableCell>
								<TableCell>
									{m.paymentSynced ? (
										<CheckCircle2 className="h-4 w-4 text-emerald-500" />
									) : (
										<XCircle className="h-4 w-4 text-muted-foreground" />
									)}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(m.lastSyncedAt)}
								</TableCell>
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
								No invoice mappings yet
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		);
	}

	return (
		<div className="py-8 text-center text-muted-foreground">
			Payment mappings are tracked via invoice mappings.
		</div>
	);
}

export default function IntegrationDetailPage() {
	const params = useParams();
	const type = params.type as SyncType;
	const { organizationId, isLoading: orgLoading } = useOrganization();
	const [env, setEnv] = useState<"sandbox" | "production">("production");
	const [isRunning, setIsRunning] = useState(false);

	const config = typeConfig[type];

	const syncRuns = useQuery(
		api.syncState.list,
		organizationId ? { organizationId, limit: 20 } : "skip",
	);

	const filteredRuns = syncRuns?.filter((r) => r.syncType === type && r.tripletexEnv === env);

	const runSync = useAction(
		type === "customers"
			? api.sync.runCustomersPublic
			: type === "products"
				? api.sync.runProductsPublic
				: type === "invoices"
					? api.sync.runInvoicesPublic
					: api.sync.runPaymentsPublic,
	);

	const handleRun = async () => {
		if (!organizationId) return;
		setIsRunning(true);
		try {
			await runSync({ organizationId, tripletexEnv: env });
		} catch (error) {
			console.error(`Sync ${type} failed:`, error);
			toast.error(`${type} sync failed`, {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setIsRunning(false);
		}
	};

	if (!config) {
		return (
			<div className="flex h-[50vh] flex-col items-center justify-center gap-4">
				<h2 className="text-xl font-semibold">Unknown integration type</h2>
				<Button render={<Link href="/integrations" />} variant="outline">
					Back to Integrations
				</Button>
			</div>
		);
	}

	if (orgLoading) {
		return (
			<div className="flex h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" render={<Link href="/integrations" />}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<config.icon className="h-5 w-5 text-primary" />
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">{config.label} Sync</h1>
						<p className="text-muted-foreground">Mapping details and run history</p>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-4">
				<Select value={env} onValueChange={(v) => v && setEnv(v as "sandbox" | "production")}>
					<SelectTrigger className="w-[160px]">
						<SelectValue />
					</SelectTrigger>
					<SelectPositioner>
						<SelectContent>
							<SelectItem value="production">Production</SelectItem>
							<SelectItem value="sandbox">Sandbox</SelectItem>
						</SelectContent>
					</SelectPositioner>
				</Select>
				<Button onClick={handleRun} disabled={isRunning || !organizationId} className="gap-2">
					{isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
					Run {config.label} Sync
				</Button>
			</div>

			<Tabs defaultValue="mappings">
				<TabsList>
					<TabsTrigger value="mappings">Mappings</TabsTrigger>
					<TabsTrigger value="history">Run History</TabsTrigger>
				</TabsList>

				<TabsContent value="mappings" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">{config.label} Mappings</CardTitle>
							<CardDescription>
								Current mappings between Rubic and Tripletex records
							</CardDescription>
						</CardHeader>
						<CardContent>{organizationId && <MappingsTable type={type} env={env} />}</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="history" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Run History</CardTitle>
							<CardDescription>
								Recent {config.label.toLowerCase()} sync runs for {env}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Status</TableHead>
										<TableHead>Started</TableHead>
										<TableHead>Completed</TableHead>
										<TableHead className="text-right">Processed</TableHead>
										<TableHead className="text-right">Failed</TableHead>
										<TableHead>Error</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredRuns && filteredRuns.length > 0 ? (
										filteredRuns.map((run) => (
											<TableRow key={run._id}>
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
											<TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
												No sync runs for this type and environment yet
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
