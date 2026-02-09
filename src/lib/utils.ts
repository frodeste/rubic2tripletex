import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Generate 1–2 character initials from a user's name or email.
 * Uses the first and last name parts (e.g. "John Kennedy" → "JK").
 * Falls back to the first character of the email, or "U" if nothing is available.
 */
export function getInitials(name?: string | null, email?: string | null): string {
	if (name) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return parts[0][0].toUpperCase();
	}
	if (email) {
		return email[0].toUpperCase();
	}
	return "U";
}

/**
 * URL for the Auth0 logout endpoint. Uses an absolute returnTo when
 * NEXT_PUBLIC_APP_URL is set so Auth0 redirects back to the app's login page.
 */
export function getLogoutHref(): string {
	const base = process.env.NEXT_PUBLIC_APP_URL;
	if (base) {
		const returnTo = `${base.replace(/\/$/, "")}/login`;
		return `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
	}
	return "/auth/logout?returnTo=/login";
}
