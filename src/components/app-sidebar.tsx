"use client";

import { ArrowLeftRight, LayoutDashboard, LogOut, Network, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0/client";
import { OrgSwitcher } from "@/components/org-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPositioner,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<SidebarMenuButton
										size="lg"
										className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
									/>
								}
							>
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? "User"} />
									<AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{user?.name ?? "User"}</span>
									<span className="truncate text-xs text-muted-foreground">
										{user?.email ?? ""}
									</span>
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuPositioner side="bottom" align="end">
								<DropdownMenuContent className="min-w-56 rounded-lg">
									<DropdownMenuItem className="gap-2" disabled>
										<User className="size-4" />
										<span>Profile</span>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
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
