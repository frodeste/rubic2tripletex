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
