export async function hashString(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

export function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

export function createToken(byteLength = 18) {
	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	return [...bytes].map((part) => part.toString(16).padStart(2, '0')).join('');
}

export function createPin() {
	const bytes = crypto.getRandomValues(new Uint32Array(1));
	return String(100000 + (bytes[0] % 900000));
}

export function normalizeQuery(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function trimOrigin(origin: string) {
	return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

export function makeSourceTrackKey(source: string, sourceTrackId: string) {
	return `${source}:${sourceTrackId}`;
}
