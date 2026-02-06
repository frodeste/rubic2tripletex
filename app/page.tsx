import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth0 } from "@/auth0";
import { db } from "@/db/client";
import { syncState } from "@/db/schema";
import TriggerButton from "./components/TriggerButton";

export default async function Home() {
	const session = await auth0.getSession();

	if (!session) {
		redirect("/api/auth/login");
	}

	const runs = await db.select().from(syncState).orderBy(desc(syncState.startedAt)).limit(20);

	const getStatusColor = (status: string) => {
		switch (status) {
			case "success":
				return "#10b981"; // green
			case "failed":
				return "#ef4444"; // red
			case "running":
				return "#f59e0b"; // yellow
			default:
				return "#6b7280"; // gray
		}
	};

	const formatDate = (date: Date | null) => {
		if (!date) return "-";
		return new Date(date).toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<main
			style={{
				padding: "2rem",
				fontFamily: "system-ui, sans-serif",
				maxWidth: "1400px",
				margin: "0 auto",
			}}
		>
			<header
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "2rem",
					paddingBottom: "1rem",
					borderBottom: "2px solid #e5e7eb",
				}}
			>
				<h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "bold" }}>Rubic2Tripletex</h1>
				<a
					href="/api/auth/logout"
					style={{
						padding: "0.5rem 1rem",
						background: "#ef4444",
						color: "white",
						textDecoration: "none",
						borderRadius: "0.375rem",
						fontWeight: "500",
					}}
				>
					Logout
				</a>
			</header>

			<section style={{ marginBottom: "2rem" }}>
				<h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Run Sync</h2>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
						gap: "1rem",
						marginBottom: "2rem",
					}}
				>
					<TriggerButton syncType="customers" />
					<TriggerButton syncType="products" />
					<TriggerButton syncType="invoices" />
					<TriggerButton syncType="payments" />
				</div>
			</section>

			<section>
				<h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Sync Status</h2>
				<div
					style={{
						overflowX: "auto",
						border: "1px solid #e5e7eb",
						borderRadius: "0.5rem",
					}}
				>
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
							backgroundColor: "white",
						}}
					>
						<thead>
							<tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
								<th
									style={{
										padding: "0.75rem",
										textAlign: "left",
										fontWeight: "600",
										fontSize: "0.875rem",
										textTransform: "uppercase",
										color: "#6b7280",
									}}
								>
									Sync Type
								</th>
								<th
									style={{
										padding: "0.75rem",
										textAlign: "left",
										fontWeight: "600",
										fontSize: "0.875rem",
										textTransform: "uppercase",
										color: "#6b7280",
									}}
								>
									Status
								</th>
								<th
									style={{
										padding: "0.75rem",
										textAlign: "left",
										fontWeight: "600",
										fontSize: "0.875rem",
										textTransform: "uppercase",
										color: "#6b7280",
									}}
								>
									Started
								</th>
								<th
									style={{
										padding: "0.75rem",
										textAlign: "left",
										fontWeight: "600",
										fontSize: "0.875rem",
										textTransform: "uppercase",
										color: "#6b7280",
									}}
								>
									Completed
								</th>
								<th
									style={{
										padding: "0.75rem",
										textAlign: "left",
										fontWeight: "600",
										fontSize: "0.875rem",
										textTransform: "uppercase",
										color: "#6b7280",
									}}
								>
									Records Processed
								</th>
								<th
									style={{
										padding: "0.75rem",
										textAlign: "left",
										fontWeight: "600",
										fontSize: "0.875rem",
										textTransform: "uppercase",
										color: "#6b7280",
									}}
								>
									Records Failed
								</th>
								<th
									style={{
										padding: "0.75rem",
										textAlign: "left",
										fontWeight: "600",
										fontSize: "0.875rem",
										textTransform: "uppercase",
										color: "#6b7280",
									}}
								>
									Error
								</th>
							</tr>
						</thead>
						<tbody>
							{runs.length === 0 ? (
								<tr>
									<td
										colSpan={7}
										style={{
											padding: "2rem",
											textAlign: "center",
											color: "#6b7280",
										}}
									>
										No sync runs found
									</td>
								</tr>
							) : (
								runs.map((run) => (
									<tr
										key={run.id}
										style={{
											borderBottom: "1px solid #e5e7eb",
										}}
									>
										<td
											style={{
												padding: "0.75rem",
												fontWeight: "500",
												textTransform: "capitalize",
											}}
										>
											{run.syncType}
										</td>
										<td style={{ padding: "0.75rem" }}>
											<span
												style={{
													display: "inline-block",
													padding: "0.25rem 0.75rem",
													borderRadius: "9999px",
													backgroundColor: getStatusColor(run.status),
													color: "white",
													fontSize: "0.875rem",
													fontWeight: "500",
													textTransform: "capitalize",
												}}
											>
												{run.status}
											</span>
										</td>
										<td style={{ padding: "0.75rem", color: "#6b7280" }}>
											{formatDate(run.startedAt)}
										</td>
										<td style={{ padding: "0.75rem", color: "#6b7280" }}>
											{formatDate(run.completedAt)}
										</td>
										<td style={{ padding: "0.75rem", color: "#6b7280" }}>
											{run.recordsProcessed ?? 0}
										</td>
										<td style={{ padding: "0.75rem", color: "#6b7280" }}>
											{run.recordsFailed ?? 0}
										</td>
										<td
											style={{
												padding: "0.75rem",
												color: "#ef4444",
												maxWidth: "300px",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
											title={run.errorMessage ?? undefined}
										>
											{run.errorMessage ?? "-"}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>
		</main>
	);
}
