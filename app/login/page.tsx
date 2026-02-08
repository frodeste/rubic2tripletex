"use client";

import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<ArrowLeftRight className="h-6 w-6" />
					</div>
					<CardTitle className="text-2xl">Rubic2Tripletex</CardTitle>
					<CardDescription>
						Integration platform for syncing data between Rubic and Tripletex
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild className="w-full" size="lg">
						<a href="/api/auth/login">Sign in with Auth0</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
