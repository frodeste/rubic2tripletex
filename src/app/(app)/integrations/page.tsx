"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	ArrowLeftRight,
	CheckCircle2,
	Clock,
	CreditCard,
	FileText,
	Loader2,
	Package,
	Play,
	Settings,
	Users,
	XCircle,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { useOrganization } from "@/hooks/use-organization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const syncTypes = [
	{
		type: "customers" as const,
		label: "Customers",
		description: "Sync customer records from Rubic to Tripletex",
		icon: Users,
		defaultCron: "0 */6 * * *",
	},
	{
		type: "products" as const,
		label: "Products",
		description: "Sync product catalog from Rubic to Tripletex",
		icon: Package,
		defaultCron: "0 */6 * * *",
	},
	{
		type: "invoices" as const,
		label: "Invoices",
		description: "Sync invoices from Rubic to Tripletex (incremental)",
		icon: FileText,
		defaultCron: "0 */2 * * *",
	},
	{
		type: "payments" as const,
		label: "Payments",
		description: "Sync payment transactions from Rubic to Tripletex",
		icon: CreditCard,
		defaultCron: "0 * * * *",
	},
] as const;

type SyncType = (typeof syncTypes)[number]["type"];

function ScheduleDialog({ syncType, defaultCron }: { syncType: SyncType; defaultCron: string }) {
	const { organizationId } = useOrganization();
	const [open, setOpen] = useState(false);
	const [cron, setCron] = useState(defaultCron);
	const [env, setEnv] = useState<"sandbox" | "production">("production");
	const [enabled, setEnabled] = useState(true);

	const upsertSchedule = useMutation(api.integrationSchedules.upsert);

	const schedules = useQuery(
		api.integrationSchedules.list,
		organizationId ? { organizationId } : "skip",
	);

	const existingSchedule = schedules?.find(
		(s) => s.syncType === syncType && s.tripletexEnv === env,
	);

	const handleSave = async () => {
		if (!organizationId) return;
		await upsertSchedule({
			organizationId,
			syncType,
			tripletexEnv: env,
			cronExpression: cron,
			isEnabled: enabled,
		});
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
				<Clock className="h-3.5 w-3.5" />
				Schedule
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						Schedule {syncTypes.find((s) => s.type === syncType)?.label} Sync
					</DialogTitle>
					<DialogDescription>
						Configure automatic sync scheduling for this integration.
					</DialogDescription>
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
						<Label>Cron Expression</Label>
						<Input
							value={cron}
							onChange={(e) => setCron(e.target.value)}
							placeholder="0 */6 * * *"
						/>
						<p className="text-xs text-muted-foreground">
							Standard cron format: minute hour day month weekday
						</p>
					</div>
					<div className="flex items-center justify-between">
						<Label>Enabled</Label>
						<Switch checked={enabled} onCheckedChange={setEnabled} />
					</div>
					{existingSchedule && (
						<p className="text-xs text-muted-foreground">
							Current schedule: {existingSchedule.cronExpression} (
							{existingSchedule.isEnabled ? "enabled" : "disabled"})
						</p>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave}>Save Schedule</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RunSyncButton({ syncType }: { syncType: SyncType }) {
	const { organizationId } = useOrganization();
	const [isRunning, setIsRunning] = useState(false);
	const [env, setEnv] = useState<"sandbox" | "production">("production");

	const runSync = useAction(
		syncType === "customers"
			? api.sync.runCustomers
			: syncType === "products"
				? api.sync.runProducts
				: syncType === "invoices"
					? api.sync.runInvoices
					: api.sync.runPayments,
	);

	const handleRun = async () => {
		if (!organizationId) return;
		setIsRunning(true);
		try {
			await runSync({ organizationId, tripletexEnv: env });
		} catch (error) {
			console.error(`Sync ${syncType} failed:`, error);
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<div className="flex items-center gap-2">
			<Select value={env} onValueChange={(v) => v && setEnv(v as "sandbox" | "production")}>
				<SelectTrigger className="w-[130px] h-8 text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectPositioner>
					<SelectContent>
						<SelectItem value="production">Production</SelectItem>
						<SelectItem value="sandbox">Sandbox</SelectItem>
					</SelectContent>
				</SelectPositioner>
			</Select>
			<Button
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
				Run Now
			</Button>
		</div>
	);
}

export default function IntegrationsPage() {
	const { organizationId, isLoading } = useOrganization();

	const schedules = useQuery(
		api.integrationSchedules.list,
		organizationId ? { organizationId } : "skip",
	);

	if (isLoading) {
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
				<p className="text-muted-foreground">Select an organization to manage integrations.</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
				<p className="text-muted-foreground">Configure, schedule, and run data sync operations</p>
			</div>

			<div className="grid gap-4">
				{syncTypes.map((sync) => {
					const syncSchedules = schedules?.filter((s) => s.syncType === sync.type) ?? [];
					const activeSchedules = syncSchedules.filter((s) => s.isEnabled);

					return (
						<Card key={sync.type}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex items-start gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<sync.icon className="h-5 w-5 text-primary" />
										</div>
										<div>
											<CardTitle className="text-lg">
												<Link href={`/integrations/${sync.type}`} className="hover:underline">
													{sync.label}
												</Link>
											</CardTitle>
											<CardDescription>{sync.description}</CardDescription>
										</div>
									</div>
									<div className="flex items-center gap-2">
										{activeSchedules.length > 0 ? (
											<Badge
												variant="default"
												className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
											>
												<Zap className="mr-1 h-3 w-3" />
												{activeSchedules.length} active schedule
												{activeSchedules.length !== 1 ? "s" : ""}
											</Badge>
										) : (
											<Badge variant="secondary">Not scheduled</Badge>
										)}
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<ScheduleDialog syncType={sync.type} defaultCron={sync.defaultCron} />
										<Button
											variant="outline"
											size="sm"
											render={<Link href={`/integrations/${sync.type}`} />}
											className="gap-2"
										>
											<Settings className="h-3.5 w-3.5" />
											Details
										</Button>
									</div>
									<RunSyncButton syncType={sync.type} />
								</div>
								{syncSchedules.length > 0 && (
									<div className="mt-4 space-y-1">
										{syncSchedules.map((s) => (
											<div
												key={s._id}
												className="flex items-center gap-2 text-sm text-muted-foreground"
											>
												<span className="font-mono text-xs">{s.cronExpression}</span>
												<span>-</span>
												<span className="capitalize">{s.tripletexEnv}</span>
												<span>-</span>
												{s.isEnabled ? (
													<CheckCircle2 className="h-3 w-3 text-emerald-500" />
												) : (
													<XCircle className="h-3 w-3 text-muted-foreground" />
												)}
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
