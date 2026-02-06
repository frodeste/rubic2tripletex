import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Rubic2Tripletex Integration",
	description: "Integration dashboard for syncing Rubic data to Tripletex",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
