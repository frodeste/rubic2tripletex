import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ConvexClientProvider } from "./convex-client-provider";
import { OrganizationProvider } from "./organization-provider";
import "./globals.css";

export const metadata: Metadata = {
	title: "Rubic2Tripletex Integration",
	description: "SaaS integration platform for syncing Rubic data to Tripletex",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="min-h-screen bg-background font-sans antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<Auth0Provider>
						<ConvexClientProvider>
							<OrganizationProvider>{children}</OrganizationProvider>
						</ConvexClientProvider>
					</Auth0Provider>
					<Toaster richColors closeButton />
				</ThemeProvider>
			</body>
		</html>
	);
}
