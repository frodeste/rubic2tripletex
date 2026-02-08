import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
	return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
	return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger {...props} />;
}

function TooltipPositioner({ className, ...props }: TooltipPrimitive.Positioner.Props) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner
				data-slot="tooltip-positioner"
				className={cn("outline-none", className)}
				{...props}
			/>
		</TooltipPrimitive.Portal>
	);
}

function TooltipContent({ className, children, ...props }: TooltipPrimitive.Popup.Props) {
	return (
		<TooltipPrimitive.Popup
			data-slot="tooltip-content"
			className={cn(
				"data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity",
				className,
			)}
			{...props}
		>
			{children}
			<TooltipArrow />
		</TooltipPrimitive.Popup>
	);
}

function TooltipArrow({ className, ...props }: TooltipPrimitive.Arrow.Props) {
	return (
		<TooltipPrimitive.Arrow
			data-slot="tooltip-arrow"
			className={cn(
				"fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipPositioner };
