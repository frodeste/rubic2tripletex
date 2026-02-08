"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import {
	ArrowLeftRight,
	Building2,
	ChevronsUpDown,
	LayoutDashboard,
	LogOut,
	Network,
	Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrgSwitcher } from "@/components/org-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPositioner,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";

const navItems = [
	{
		title: "Dashboard",
		href: "/dashboard",
		icon: LayoutDashboard,
	},
	{
		title: "Integrations",
		href: "/integrations",
		icon: ArrowLeftRight,
	},
	{
		title: "Departments",
		href: "/departments",
		icon: Network,
	},
	{
		title: "Settings",
		href: "/settings",
		icon: Settings,
	},
	{
		title: "Organization",
		href: "/settings/organization",
		icon: Building2,
	},
];

export function AppSidebar() {
	const pathname = usePathname();
	const { user } = useUser();

	const initials = user?.name
		? user.name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
		: "U";

	return (
		<Sidebar>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<OrgSwitcher />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										render={<Link href={item.href} />}
										isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
									>
										<item.icon className="size-4" />
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<div className="flex items-center justify-between px-2 py-1">
							<ThemeToggle />
						</div>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							render={<Link href="/profile" />}
							isActive={pathname === "/profile"}
						>
							<Avatar className="h-8 w-8 rounded-lg">
								<AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? "User"} />
								<AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">{user?.name ?? "User"}</span>
								<span className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</span>
							</div>
						</SidebarMenuButton>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<button
										type="button"
										className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
									/>
								}
							>
								<ChevronsUpDown className="size-4" />
							</DropdownMenuTrigger>
							<DropdownMenuPositioner side="top" align="end">
								<DropdownMenuContent className="min-w-40 rounded-lg">
									{/* biome-ignore lint/a11y/useAnchorContent: Content provided by DropdownMenuItem's render prop */}
									<DropdownMenuItem className="gap-2" render={<a href="/auth/logout" />}>
										<LogOut className="size-4" />
										<span>Log out</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenuPositioner>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
