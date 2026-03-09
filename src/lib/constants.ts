export const GUEST_COOKIE_NAME = 'djr_guest_id';
export const GUEST_STORAGE_KEY = 'djr:guest-id';
export const SETUP_STORAGE_PREFIX = 'djr:setup:';

export function getAdminCookieName(roomSlug: string) {
	return `djr_admin_${roomSlug}`;
}

export function getSetupStorageKey(roomSlug: string) {
	return `${SETUP_STORAGE_PREFIX}${roomSlug}`;
}
