import { auth0 } from "@/auth0";

export const GET = async (req: Request) => {
	return auth0.middleware(req);
};

export const POST = async (req: Request) => {
	return auth0.middleware(req);
};
