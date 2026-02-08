import { redirect } from "next/navigation";
import { auth0 } from "@/auth0";

export default async function Home() {
	const session = await auth0.getSession();

	if (!session) {
		redirect("/auth/login");
	}

	redirect("/dashboard");
}
