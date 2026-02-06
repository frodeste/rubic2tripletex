"use client";

import { useState } from "react";

interface TriggerButtonProps {
	syncType: string;
}

export default function TriggerButton({ syncType }: TriggerButtonProps) {
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const handleClick = async () => {
		setLoading(true);
		setMessage(null);

		try {
			const response = await fetch(`/api/trigger/${syncType}`, {
				method: "POST",
			});

			const data = await response.json();

			if (!response.ok) {
				setMessage({ type: "error", text: data.error || "Failed to trigger sync" });
			} else {
				setMessage({ type: "success", text: data.message || "Sync triggered successfully" });
			}
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "Failed to trigger sync",
			});
		} finally {
			setLoading(false);
			// Clear message after 3 seconds
			setTimeout(() => setMessage(null), 3000);
		}
	};

	return (
		<div>
			<button
				type="button"
				onClick={handleClick}
				disabled={loading}
				style={{
					width: "100%",
					padding: "0.75rem 1rem",
					background: loading ? "#9ca3af" : "#3b82f6",
					color: "white",
					border: "none",
					borderRadius: "0.375rem",
					fontWeight: "500",
					cursor: loading ? "not-allowed" : "pointer",
					textTransform: "capitalize",
					fontSize: "1rem",
				}}
			>
				{loading ? "Running..." : `Run ${syncType} Sync`}
			</button>
			{message && (
				<div
					style={{
						marginTop: "0.5rem",
						padding: "0.5rem",
						borderRadius: "0.25rem",
						backgroundColor: message.type === "success" ? "#d1fae5" : "#fee2e2",
						color: message.type === "success" ? "#065f46" : "#991b1b",
						fontSize: "0.875rem",
					}}
				>
					{message.text}
				</div>
			)}
		</div>
	);
}
