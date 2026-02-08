"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowRight, Loader2, Network, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useOrganization } from "@/hooks/use-organization";
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
import { Label } from "@/components/ui/label";
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

interface RubicDept {
	productDepartmentID: number;
	productDepartmentName: string | null;
	productDepartmentNumber: string | null;
}

interface TripletexDept {
	id: number;
	name?: string;
	number?: string;
}

export default function DepartmentsPage() {
	const { organizationId, isLoading: orgLoading } = useOrganization();
	const [env, setEnv] = useState<"sandbox" | "production">("production");
	const [rubicDepts, setRubicDepts] = useState<RubicDept[]>([]);
	const [tripletexDepts, setTripletexDepts] = useState<TripletexDept[]>([]);
	const [loadingRubic, setLoadingRubic] = useState(false);
	const [loadingTripletex, setLoadingTripletex] = useState(false);
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [selectedRubicDept, setSelectedRubicDept] = useState<string>("");
	const [selectedTripletexDept, setSelectedTripletexDept] = useState<string>("");

	const mappings = useQuery(
		api.departmentMapping.list,
		organizationId ? { organizationId, tripletexEnv: env } : "skip",
	);

	const upsertMapping = useMutation(api.departmentMapping.upsert);
	const removeMapping = useMutation(api.departmentMapping.remove);
	const fetchRubicDepts = useAction(api.sync.fetchDepartmentsFromRubic);
	const fetchTripletexDepts = useAction(api.sync.fetchDepartmentsFromTripletex);

	const loadRubicDepartments = async () => {
		if (!organizationId) return;
		setLoadingRubic(true);
		try {
			const depts = await fetchRubicDepts({ organizationId });
			setRubicDepts(depts as RubicDept[]);
		} catch (error) {
			console.error("Failed to fetch Rubic departments:", error);
		} finally {
			setLoadingRubic(false);
		}
	};

	const loadTripletexDepartments = async () => {
		if (!organizationId) return;
		setLoadingTripletex(true);
		try {
			const depts = await fetchTripletexDepts({
				organizationId,
				tripletexEnv: env,
			});
			setTripletexDepts(depts as TripletexDept[]);
		} catch (error) {
			console.error("Failed to fetch Tripletex departments:", error);
		} finally {
			setLoadingTripletex(false);
		}
	};

	const handleAddMapping = async () => {
		if (!organizationId || !selectedRubicDept || !selectedTripletexDept) return;

		const rubicDept = rubicDepts.find(
			(d) => d.productDepartmentID.toString() === selectedRubicDept,
		);
		const tripletexDept = tripletexDepts.find((d) => d.id.toString() === selectedTripletexDept);

		if (!rubicDept || !tripletexDept) return;

		await upsertMapping({
			organizationId,
			rubicDepartmentId: rubicDept.productDepartmentID,
			rubicDepartmentName: rubicDept.productDepartmentName ?? "Unknown",
			tripletexDepartmentId: tripletexDept.id,
			tripletexDepartmentName: tripletexDept.name ?? "Unknown",
			tripletexEnv: env,
		});

		setAddDialogOpen(false);
		setSelectedRubicDept("");
		setSelectedTripletexDept("");
	};

	const handleRemoveMapping = async (mappingId: Id<"departmentMapping">) => {
		await removeMapping({ departmentMappingId: mappingId });
	};

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
				<Network className="h-12 w-12 text-muted-foreground" />
				<h2 className="text-xl font-semibold">No Organization Selected</h2>
			</div>
		);
	}

	// Filter out already-mapped departments
	const mappedRubicIds = new Set(mappings?.map((m) => m.rubicDepartmentId) ?? []);
	const unmappedRubicDepts = rubicDepts.filter((d) => !mappedRubicIds.has(d.productDepartmentID));

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Department Mapping</h1>
					<p className="text-muted-foreground">Map departments between Rubic and Tripletex</p>
				</div>
				<div className="flex items-center gap-2">
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
				</div>
			</div>

			{/* Fetch departments */}
			<div className="flex gap-2">
				<Button
					variant="outline"
					onClick={loadRubicDepartments}
					disabled={loadingRubic}
					className="gap-2"
				>
					{loadingRubic ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="h-4 w-4" />
					)}
					Load Rubic Departments
					{rubicDepts.length > 0 && <Badge variant="secondary">{rubicDepts.length}</Badge>}
				</Button>
				<Button
					variant="outline"
					onClick={loadTripletexDepartments}
					disabled={loadingTripletex}
					className="gap-2"
				>
					{loadingTripletex ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<RefreshCw className="h-4 w-4" />
					)}
					Load Tripletex Departments
					{tripletexDepts.length > 0 && <Badge variant="secondary">{tripletexDepts.length}</Badge>}
				</Button>
			</div>

			{/* Existing mappings */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-lg">Mapped Departments</CardTitle>
							<CardDescription>
								{mappings?.length ?? 0} department
								{(mappings?.length ?? 0) !== 1 ? "s" : ""} mapped for {env}
							</CardDescription>
						</div>
						<Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
							<DialogTrigger
								render={
									<Button
										size="sm"
										className="gap-2"
										disabled={rubicDepts.length === 0 || tripletexDepts.length === 0}
									/>
								}
							>
								<Plus className="h-4 w-4" />
								Add Mapping
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Add Department Mapping</DialogTitle>
									<DialogDescription>
										Select a Rubic department and the corresponding Tripletex department.
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-4">
									<div className="space-y-2">
										<Label>Rubic Department</Label>
										<Select
											value={selectedRubicDept}
											onValueChange={(v) => v !== null && setSelectedRubicDept(v)}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select Rubic department" />
											</SelectTrigger>
											<SelectPositioner>
												<SelectContent>
													{unmappedRubicDepts.map((d) => (
														<SelectItem
															key={d.productDepartmentID}
															value={d.productDepartmentID.toString()}
														>
															{d.productDepartmentName ?? `Dept ${d.productDepartmentID}`}
															{d.productDepartmentNumber ? ` (${d.productDepartmentNumber})` : ""}
														</SelectItem>
													))}
												</SelectContent>
											</SelectPositioner>
										</Select>
									</div>
									<div className="flex justify-center">
										<ArrowRight className="h-5 w-5 text-muted-foreground" />
									</div>
									<div className="space-y-2">
										<Label>Tripletex Department</Label>
										<Select
											value={selectedTripletexDept}
											onValueChange={(v) => v !== null && setSelectedTripletexDept(v)}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select Tripletex department" />
											</SelectTrigger>
											<SelectPositioner>
												<SelectContent>
													{tripletexDepts.map((d) => (
														<SelectItem key={d.id} value={d.id.toString()}>
															{d.name ?? `Dept ${d.id}`}
															{d.number ? ` (${d.number})` : ""}
														</SelectItem>
													))}
												</SelectContent>
											</SelectPositioner>
										</Select>
									</div>
								</div>
								<DialogFooter>
									<Button variant="outline" onClick={() => setAddDialogOpen(false)}>
										Cancel
									</Button>
									<Button
										onClick={handleAddMapping}
										disabled={!selectedRubicDept || !selectedTripletexDept}
									>
										Add Mapping
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Rubic Department</TableHead>
								<TableHead className="w-12" />
								<TableHead>Tripletex Department</TableHead>
								<TableHead className="w-16" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{mappings && mappings.length > 0 ? (
								mappings.map((m) => (
									<TableRow key={m._id}>
										<TableCell>
											<div>
												<span className="font-medium">{m.rubicDepartmentName}</span>
												<span className="ml-2 text-xs text-muted-foreground">
													ID: {m.rubicDepartmentId}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<ArrowRight className="h-4 w-4 text-muted-foreground" />
										</TableCell>
										<TableCell>
											<div>
												<span className="font-medium">{m.tripletexDepartmentName}</span>
												<span className="ml-2 text-xs text-muted-foreground">
													ID: {m.tripletexDepartmentId}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-destructive"
												onClick={() => handleRemoveMapping(m._id)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
										No department mappings yet. Load departments from both systems, then add
										mappings.
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
