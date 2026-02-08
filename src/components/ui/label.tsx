import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Reusable wrapper — htmlFor/children provided at usage sites
		<label
			data-slot="label"
			className={cn(
				"flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
