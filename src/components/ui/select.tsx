"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
	return <SelectPrimitive.Group {...props} />;
}

function SelectValue({
	placeholder,
	...props
}: SelectPrimitive.Value.Props & {
	placeholder?: string;
}) {
	if (!placeholder) {
		return <SelectPrimitive.Value {...props} />;
	}

	return (
		<SelectPrimitive.Value
			{...props}
			placeholder={
				((value) => {
					if (value) {
						return <SelectPrimitive.Value />;
					}

					// Placeholder
					return <span className="text-muted-foreground">{placeholder}</span>;
				}) as never
			}
		/>
	);
}

function SelectTrigger({
	className,
	size = "default",
	children,
	...props
}: SelectPrimitive.Trigger.Props & {
	size?: "sm" | "default";
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				"border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				size === "default" && "h-9",
				size === "sm" && "h-8",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon>
				<ChevronDownIcon className="size-4 opacity-50" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

function SelectPositioner({ className, ...props }: SelectPrimitive.Positioner.Props) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				data-slot="select-positioner"
				className={cn("outline-none", className)}
				{...props}
			/>
		</SelectPrimitive.Portal>
	);
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
	return (
		<>
			<SelectScrollUpButton />
			<SelectPrimitive.Popup
				data-slot="select-content"
				className={cn(
					"data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md transition-opacity",
					className,
				)}
				{...props}
			>
				{children}
			</SelectPrimitive.Popup>
			<SelectScrollDownButton />
		</>
	);
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
	return (
		<SelectPrimitive.GroupLabel
			data-slot="select-label"
			className={cn("py-1.5 pr-2 pl-8 text-sm font-semibold", className)}
			{...props}
		/>
	);
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				"focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
				className,
			)}
			{...props}
		>
			<span className="absolute right-2 flex size-3.5 items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn("-mx-1 my-1 h-px bg-muted", className)}
			{...props}
		/>
	);
}

function SelectScrollUpButton({ className, ...props }: SelectPrimitive.ScrollUpArrow.Props) {
	return (
		<SelectPrimitive.ScrollUpArrow
			data-slot="select-scroll-up-button"
			className={cn("flex cursor-default items-center justify-center py-1", className)}
			{...props}
		>
			<ChevronUpIcon className="size-4" />
		</SelectPrimitive.ScrollUpArrow>
	);
}

function SelectScrollDownButton({ className, ...props }: SelectPrimitive.ScrollDownArrow.Props) {
	return (
		<SelectPrimitive.ScrollDownArrow
			data-slot="select-scroll-down-button"
			className={cn("flex cursor-default items-center justify-center py-1", className)}
			{...props}
		>
			<ChevronDownIcon className="size-4" />
		</SelectPrimitive.ScrollDownArrow>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
	SelectPositioner,
};
