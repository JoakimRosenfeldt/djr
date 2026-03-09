import { browser } from '$app/environment';
import {
	GUEST_COOKIE_NAME,
	GUEST_STORAGE_KEY,
	getAdminCookieName,
	getSetupStorageKey
} from '$lib/constants';

function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 365) {
	if (!browser) {
		return;
	}

	document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function getCookie(name: string) {
	if (!browser) {
		return null;
	}

	const cookieValue = document.cookie
		.split('; ')
		.find((entry) => entry.startsWith(`${name}=`))
		?.split('=')
		.slice(1)
		.join('=');

	return cookieValue ? decodeURIComponent(cookieValue) : null;
}

export function ensureGuestId(initialGuestId?: string) {
	if (!browser) {
		return initialGuestId ?? null;
	}

	const existing =
		initialGuestId ?? localStorage.getItem(GUEST_STORAGE_KEY) ?? getCookie(GUEST_COOKIE_NAME);

	if (existing) {
		localStorage.setItem(GUEST_STORAGE_KEY, existing);
		setCookie(GUEST_COOKIE_NAME, existing);
		return existing;
	}

	const guestId = crypto.randomUUID();
	localStorage.setItem(GUEST_STORAGE_KEY, guestId);
	setCookie(GUEST_COOKIE_NAME, guestId);
	return guestId;
}

export function saveAdminSession(roomSlug: string, sessionToken: string) {
	if (!browser) {
		return;
	}

	localStorage.setItem(getAdminCookieName(roomSlug), sessionToken);
	setCookie(getAdminCookieName(roomSlug), sessionToken, 60 * 60 * 24 * 14);
}

export function readAdminSession(roomSlug: string) {
	if (!browser) {
		return null;
	}

	return (
		localStorage.getItem(getAdminCookieName(roomSlug)) ?? getCookie(getAdminCookieName(roomSlug))
	);
}

export function clearAdminSession(roomSlug: string) {
	if (!browser) {
		return;
	}

	localStorage.removeItem(getAdminCookieName(roomSlug));
	document.cookie = `${getAdminCookieName(roomSlug)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function saveSetupPayload(
	roomSlug: string,
	payload: { guestUrl: string; adminUrl: string; pin: string }
) {
	if (!browser) {
		return;
	}

	localStorage.setItem(getSetupStorageKey(roomSlug), JSON.stringify(payload));
}

export function readSetupPayload(roomSlug: string) {
	if (!browser) {
		return null;
	}

	const raw = localStorage.getItem(getSetupStorageKey(roomSlug));

	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw) as { guestUrl: string; adminUrl: string; pin: string };
	} catch {
		return null;
	}
}
